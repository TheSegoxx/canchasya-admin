<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ErrorHttp;
use App\Models\Cancha;
use App\Models\Complejo;
use App\Models\Espera;
use App\Models\PartidoAbierto;
use App\Services\AgendaService;
use App\Services\Fidelidad;
use App\Services\Notificaciones;

/**
 * Lo que el jugador hace además de reservar: anotarse en la lista de espera de un horario
 * ocupado, sumarse a partidos que buscan jugadores ("me falta uno") y ver sus sellos de fidelidad.
 */
final class JugadorController extends Controlador
{
    private Espera $esperas;
    private PartidoAbierto $partidos;

    public function __construct()
    {
        parent::__construct();
        $this->esperas = new Espera($this->pdo);
        $this->partidos = new PartidoAbierto($this->pdo);
    }

    // GET /esperas  (las que todavía no pasaron)
    public function listarEsperas(): void
    {
        $this->soloJugador();
        responder(200, ['esperas' => array_map([$this->esperas, 'publico'], $this->esperas->listarDelUsuario($this->usuarioActual()))]);
    }

    /**
     * POST /esperas  {canchaId, fecha, horaInicio, duracionMin}
     * Solo para un horario que hoy está ocupado (si está libre, que lo reserve).
     */
    public function crearEspera(): void
    {
        $this->soloJugador();
        $usuarioId = $this->usuarioActual();
        $datos = leerJson();
        $cancha = (new Cancha($this->pdo))->buscarPorId(idRequerido($datos, 'canchaId', 'la cancha'));
        $complejo = $cancha !== null ? (new Complejo($this->pdo))->buscarPorId((int) $cancha['complejo_id']) : null;
        if ($cancha === null || !$cancha['habilitada'] || !$complejo['visible'] || !$complejo['reservas_online']) {
            responder(404, ['error' => 'Esa cancha no existe o no toma reservas por la app']);
        }
        $fecha = fechaRequerida($datos, 'fecha', 'el día');
        if ($fecha < hoy() || $fecha > sumarDias(hoy(), (int) $complejo['reserva_dias'])) {
            responder(400, ['error' => 'Ese día no se puede reservar']);
        }
        $inicio = horaRequerida($datos, 'horaInicio', 'la hora');
        $duracion = $datos['duracionMin'] ?? null;
        if (!is_int($duracion) || $duracion < (int) $cancha['duracion_min'] || $duracion > 240 || $duracion % 30 !== 0 || minutosDe($inicio) % 30 !== 0) {
            responder(400, ['error' => 'El horario o la duración no son válidos']);
        }
        $fin = minutosDe($inicio) + $duracion;
        if ($inicio < $complejo['hora_apertura'] || $fin > minutosDe($complejo['hora_cierre'])) {
            responder(400, ['error' => 'Ese horario queda fuera del horario del complejo']);
        }
        if ($fecha === hoy() && $inicio <= date('H:i:s')) {
            responder(409, ['error' => 'Ese horario ya empezó']);
        }
        $agenda = new AgendaService($this->pdo);
        $this->transaccion(fn () => $agenda->materializarFijos((int) $complejo['id'], $fecha, (int) $cancha['id']));
        if ($agenda->conflicto((int) $cancha['id'], $fecha, $inicio, horaDe($fin)) === null) {
            responder(409, ['error' => 'Ese horario está libre: ¡reservalo!']);
        }
        if ($this->esperas->contarPendientes($usuarioId) >= Espera::MAXIMO_PENDIENTES) {
            responder(409, ['error' => 'Ya estás esperando ' . Espera::MAXIMO_PENDIENTES . ' horarios. Borrá alguno para anotarte en otro.']);
        }
        try {
            $id = $this->esperas->crear($usuarioId, (int) $cancha['id'], $fecha, $inicio, $duracion);
        } catch (\PDOException $e) {
            if ($e->getCode() === '23000') {
                responder(409, ['error' => 'Ya estás en la lista de espera de ese horario']);
            }
            throw $e;
        }
        $fila = array_values(array_filter($this->esperas->listarDelUsuario($usuarioId), fn (array $e) => (int) $e['id'] === $id))[0];
        responder(201, ['espera' => $this->esperas->publico($fila)]);
    }

    // DELETE /esperas/:id
    public function borrarEspera(int $id): void
    {
        $this->soloJugador();
        if (!$this->esperas->borrar($id, $this->usuarioActual())) {
            responder(404, ['error' => 'Esa espera no existe']);
        }
        responder(204);
    }

    // GET /partidos?deporte=padel  Los partidos que buscan jugadores
    public function listarPartidos(): void
    {
        $this->soloJugador();
        $deporte = $_GET['deporte'] ?? null;
        if ($deporte !== null && !in_array($deporte, Cancha::DEPORTES, true)) {
            responder(400, ['error' => 'El deporte no es válido']);
        }
        responder(200, ['partidos' => array_map(
            [$this->partidos, 'publico'],
            $this->partidos->listarAbiertos($this->usuarioActual(), $deporte)
        )]);
    }

    // POST /partidos/:id/jugadores  Sumarse (el organizador ve tu nombre y tu celular)
    public function sumarme(int $id): void
    {
        $this->soloJugador();
        $usuarioId = $this->usuarioActual();
        $partido = $this->partidos->buscarVisible($id, $usuarioId);
        if ($partido === null) {
            responder(404, ['error' => 'Ese partido ya no busca jugadores']);
        }
        if ((int) $partido['organizador_id'] === $usuarioId) {
            responder(409, ['error' => 'Es tu partido']);
        }
        $faltaban = $this->transaccion(function () use ($id, $usuarioId) {
            $this->partidos->trabar($id);
            $p = $this->partidos->buscarVisible($id, $usuarioId);
            if ($p['sumado']) {
                throw new ErrorHttp(409, 'Ya estás en este partido');
            }
            if ($p['cerrado'] || (int) $p['sumados'] >= (int) $p['faltan']) {
                throw new ErrorHttp(409, 'Llegaste tarde: el partido ya se completó');
            }
            $this->partidos->sumar($id, $usuarioId);
            return (int) $p['faltan'] - (int) $p['sumados'] - 1;
        });

        $nombre = $this->usuario()['nombre'];
        (new Notificaciones($this->pdo))->alUsuario(
            (int) $partido['organizador_id'],
            $faltaban === 0 ? "¡$nombre completó tu partido!" : "$nombre se sumó a tu partido",
            sprintf(
                '%s, %s. %s',
                $partido['cancha_nombre'],
                Notificaciones::cuando($partido['fecha'], $partido['hora_inicio']),
                $faltaban === 0 ? 'Ya no te falta nadie.' : ($faltaban === 1 ? 'Te falta 1.' : "Te faltan $faltaban.")
            ),
            ['reservaId' => (int) $partido['turno_id']]
        );
        responder(200, ['partido' => $this->partidos->publico($this->partidos->buscarVisible($id, $usuarioId))]);
    }

    // DELETE /partidos/:id/jugadores  Bajarse
    public function bajarme(int $id): void
    {
        $this->soloJugador();
        $usuarioId = $this->usuarioActual();
        $partido = $this->partidos->buscarVisible($id, $usuarioId);
        if ($partido === null || !$this->partidos->bajar($id, $usuarioId)) {
            responder(404, ['error' => 'No estabas en ese partido']);
        }
        (new Notificaciones($this->pdo))->alUsuario(
            (int) $partido['organizador_id'],
            strtok($this->usuario()['nombre'], ' ') . ' se bajó de tu partido',
            sprintf('%s, %s. Volvió a aparecer para que se sume otro.', $partido['cancha_nombre'], Notificaciones::cuando($partido['fecha'], $partido['hora_inicio'])),
            ['reservaId' => (int) $partido['turno_id']]
        );
        responder(200, ['partido' => $this->partidos->publico($this->partidos->buscarVisible($id, $usuarioId))]);
    }

    // GET /fidelidad  Los sellos del jugador en cada complejo con programa de fidelidad
    public function tarjetas(): void
    {
        $this->soloJugador();
        responder(200, ['tarjetas' => (new Fidelidad($this->pdo))->tarjetas($this->usuarioActual())]);
    }
}
