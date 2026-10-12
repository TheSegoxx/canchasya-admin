<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ErrorHttp;
use App\Models\Bloqueo;
use App\Models\Cancha;
use App\Models\EquipoTorneo;
use App\Models\Partido;
use App\Models\Torneo;
use App\Services\AgendaService;
use App\Services\Fixture;
use App\Services\TorneoService;

/**
 * Endpoints /torneos, /torneo-equipos y /partidos.
 * Crear, borrar y sortear es del dueño; equipos, resultados y programación, también del encargado.
 */
final class TorneoController extends Controlador
{
    private const MAXIMO_EQUIPOS = 32;

    private Torneo $torneos;
    private EquipoTorneo $equipos;
    private Partido $partidos;
    private TorneoService $servicio;

    public function __construct()
    {
        parent::__construct();
        $this->torneos = new Torneo($this->pdo);
        $this->equipos = new EquipoTorneo($this->pdo);
        $this->partidos = new Partido($this->pdo);
        $this->servicio = new TorneoService($this->pdo);
    }

    // GET /torneos
    public function listar(): void
    {
        $complejoId = (int) $this->complejoActual()['id'];
        responder(200, ['torneos' => array_map([$this->torneos, 'publico'], $this->torneos->listarPorComplejo($complejoId))]);
    }

    // POST /torneos  {nombre, deporte, formato}
    public function crear(): void
    {
        $this->soloDueno();
        $complejoId = (int) $this->complejoActual()['id'];
        $datos = leerJson();
        $deporte = textoDe($datos, 'deporte');
        if (!in_array($deporte, Cancha::DEPORTES, true)) {
            responder(400, ['error' => 'El deporte tiene que ser pádel o fútbol 5']);
        }
        $formato = textoDe($datos, 'formato');
        if (!in_array($formato, Torneo::FORMATOS, true)) {
            responder(400, ['error' => 'El formato tiene que ser liga o eliminación directa']);
        }
        $id = $this->torneos->crear($complejoId, textoRequerido($datos, 'nombre', 100, 'el nombre del torneo'), $deporte, $formato);
        responder(201, ['torneo' => $this->torneos->publico($this->torneos->buscarPorId($id))]);
    }

    // GET /torneos/:id  (con equipos, partidos, tabla y campeón)
    public function obtener(int $id): void
    {
        $torneo = $this->torneoPropio($id);
        responder(200, $this->detalle($torneo));
    }

    // DELETE /torneos/:id  (también libera las canchas reservadas para sus partidos)
    public function borrar(int $id): void
    {
        $this->soloDueno();
        $this->torneoPropio($id);
        $this->transaccion(function () use ($id) {
            $bloqueos = new Bloqueo($this->pdo);
            foreach ($this->partidos->bloqueosDelTorneo($id) as $bloqueoId) {
                $bloqueos->borrar($bloqueoId);
            }
            $this->partidos->borrarDelTorneo($id);
            $this->torneos->borrar($id);
        });
        responder(204);
    }

    // POST /torneos/:id/equipos  {nombre, integrantes?, telefono?}
    public function agregarEquipo(int $id): void
    {
        $torneo = $this->torneoPropio($id);
        if ($torneo['estado'] !== 'inscripcion') {
            responder(409, ['error' => 'El fixture ya se sorteó: no se pueden agregar equipos']);
        }
        if (count($this->equipos->listarPorTorneo($id)) >= self::MAXIMO_EQUIPOS) {
            responder(409, ['error' => 'Un torneo puede tener hasta ' . self::MAXIMO_EQUIPOS . ' equipos']);
        }
        $datos = leerJson();
        $nombre = textoRequerido($datos, 'nombre', 60, 'el nombre del equipo');
        if ($this->equipos->nombreEnUso($id, $nombre)) {
            responder(409, ['error' => "Ya hay un equipo llamado \"$nombre\""]);
        }
        $integrantes = trim(textoDe($datos, 'integrantes'));
        if (mb_strlen($integrantes) > 150) {
            responder(400, ['error' => 'Los integrantes no pueden superar los 150 caracteres']);
        }
        $telefono = null;
        if (trim(textoDe($datos, 'telefono')) !== '') {
            $telefono = normalizarTelefono(textoDe($datos, 'telefono'));
            if ($telefono === null) {
                responder(400, ['error' => 'El teléfono no es válido. Escribilo con el código de área.']);
            }
        }
        $equipoId = $this->equipos->crear($id, $nombre, $integrantes !== '' ? $integrantes : null, $telefono);
        responder(201, ['equipo' => $this->equipos->publico($this->equipos->buscarPorId($equipoId))]);
    }

    // DELETE /torneo-equipos/:id  (solo antes del sorteo)
    public function borrarEquipo(int $id): void
    {
        $equipo = $this->verificarDelComplejo($this->equipos->buscarConDueno($id), 'El equipo');
        if ($equipo['torneo_estado'] !== 'inscripcion') {
            responder(409, ['error' => 'El fixture ya se sorteó: no se pueden sacar equipos']);
        }
        $this->equipos->borrar($id);
        responder(204);
    }

    /**
     * POST /torneos/:id/sorteo
     * Mezcla los equipos al azar y arma el fixture (liga) o el cuadro (eliminación).
     */
    public function sortear(int $id): void
    {
        $this->soloDueno();
        $this->torneoPropio($id);
        $this->transaccion(function () use ($id) {
            $torneo = $this->torneos->trabar($id);
            if ($torneo['estado'] !== 'inscripcion') {
                throw new ErrorHttp(409, 'El fixture ya se sorteó');
            }
            $ids = array_map(fn (array $e) => (int) $e['id'], $this->equipos->listarPorTorneo($id));
            if (count($ids) < 2) {
                throw new ErrorHttp(409, 'Hacen falta al menos 2 equipos para sortear');
            }
            shuffle($ids);

            if ($torneo['formato'] === 'liga') {
                foreach (Fixture::liga($ids) as $p) {
                    $this->partidos->crear($id, $p['ronda'], $p['orden'], $p['local'], $p['visitante']);
                }
            } else {
                $cuadro = Fixture::eliminacion($ids);
                // Todas las rondas de una vez; las siguientes arrancan sin equipos
                for ($ronda = 2; $ronda <= $cuadro['rondas']; $ronda++) {
                    for ($orden = 0; $orden < 2 ** ($cuadro['rondas'] - $ronda); $orden++) {
                        $this->partidos->crear($id, $ronda, $orden, null, null);
                    }
                }
                foreach ($cuadro['primera'] as $p) {
                    // Quien no tiene rival pasa directo a la ronda siguiente
                    $libre = $p['local'] === null || $p['visitante'] === null;
                    $ganador = $libre ? ($p['local'] ?? $p['visitante']) : null;
                    $partidoId = $this->partidos->crear($id, 1, $p['orden'], $p['local'], $p['visitante'], $ganador);
                    if ($libre) {
                        $this->servicio->pasarDeRonda($this->partidos->buscarPorId($partidoId), $ganador);
                    }
                }
            }
            $this->torneos->cambiarEstado($id, 'en_curso');
        });
        responder(200, $this->detalle($this->torneos->buscarPorId($id)));
    }

    // PUT /partidos/:id/resultado  {local, visitante}  (goles o sets)
    public function cargarResultado(int $id): void
    {
        $partido = $this->verificarDelComplejo($this->partidos->buscarConDueno($id), 'El partido');
        if ($partido['local_id'] === null || $partido['visitante_id'] === null) {
            responder(409, ['error' => 'Todavía no se conocen los dos equipos de este partido']);
        }
        $datos = leerJson();
        $local = $datos['local'] ?? null;
        $visitante = $datos['visitante'] ?? null;
        if (!is_int($local) || !is_int($visitante) || $local < 0 || $visitante < 0 || $local > 99 || $visitante > 99) {
            responder(400, ['error' => 'El resultado tiene que ser dos números de 0 a 99']);
        }
        if ($local === $visitante && ($partido['formato'] === 'eliminacion' || $partido['deporte'] === 'padel')) {
            responder(400, ['error' => $partido['deporte'] === 'padel'
                ? 'En pádel no hay empate: cargá los sets que ganó cada pareja'
                : 'En eliminación directa tiene que haber un ganador']);
        }
        $ganador = $local === $visitante ? null
            : (int) ($local > $visitante ? $partido['local_id'] : $partido['visitante_id']);

        $this->transaccion(function () use ($partido, $id, $local, $visitante, $ganador) {
            $torneo = $this->torneos->trabar((int) $partido['torneo_id']);
            $this->partidos->guardarResultado($id, $local, $visitante, $ganador);
            if ($torneo['formato'] === 'eliminacion') {
                $this->servicio->pasarDeRonda($partido, $ganador);
            }
            $this->servicio->actualizarEstado($torneo, $this->equipos->listarPorTorneo((int) $torneo['id']));
        });
        responder(200, $this->detalle($this->torneos->buscarPorId((int) $partido['torneo_id'])));
    }

    // DELETE /partidos/:id/resultado  (para corregir un resultado cargado por error)
    public function borrarResultado(int $id): void
    {
        $partido = $this->verificarDelComplejo($this->partidos->buscarConDueno($id), 'El partido');
        if ($partido['resultado_local'] === null) {
            responder(409, ['error' => 'Ese partido no tiene resultado']);
        }
        $this->transaccion(function () use ($partido, $id) {
            $torneo = $this->torneos->trabar((int) $partido['torneo_id']);
            $this->partidos->guardarResultado($id, null, null, null);
            if ($torneo['formato'] === 'eliminacion') {
                $this->servicio->pasarDeRonda($partido, null);
            }
            $this->servicio->actualizarEstado($torneo, $this->equipos->listarPorTorneo((int) $torneo['id']));
        });
        responder(200, $this->detalle($this->torneos->buscarPorId((int) $partido['torneo_id'])));
    }

    /**
     * PUT /partidos/:id/programacion  {canchaId, fecha, hora}
     * Reserva la cancha en la agenda con un bloqueo, para que nadie cargue un turno encima.
     */
    public function programar(int $id): void
    {
        $partido = $this->verificarDelComplejo($this->partidos->buscarConDueno($id), 'El partido');
        $complejo = $this->complejoActual();
        $datos = leerJson();
        $cancha = $this->verificarDelComplejo(
            (new Cancha($this->pdo))->buscarConDueno(idRequerido($datos, 'canchaId', 'la cancha')),
            'La cancha'
        );
        if (!$cancha['habilitada']) {
            responder(409, ['error' => 'La cancha está deshabilitada']);
        }
        $fecha = fechaRequerida($datos, 'fecha', 'la fecha');
        if ($fecha < hoy()) {
            responder(400, ['error' => 'No se puede programar un partido en un día que ya pasó']);
        }
        $inicio = horaRequerida($datos, 'hora', 'la hora');
        $finMinutos = minutosDe($inicio) + (int) $cancha['duracion_min'];
        if ($inicio < $complejo['hora_apertura'] || $finMinutos > minutosDe($complejo['hora_cierre'])) {
            responder(400, ['error' => 'A esa hora el partido queda fuera del horario del complejo']);
        }
        $fin = horaDe($finMinutos);

        $this->transaccion(function () use ($partido, $id, $complejo, $cancha, $fecha, $inicio, $fin) {
            $bloqueos = new Bloqueo($this->pdo);
            $agenda = new AgendaService($this->pdo);
            $canchaId = (int) $cancha['id'];
            $agenda->trabarCancha($canchaId);
            // Si ya estaba programado se libera el horario anterior
            if ($partido['bloqueo_id'] !== null) {
                $bloqueos->borrar((int) $partido['bloqueo_id']);
            }
            $agenda->materializarFijos((int) $complejo['id'], $fecha, $canchaId);
            $agenda->verificarLibre($canchaId, $fecha, $inicio, $fin);
            [$desde, $hasta] = AgendaService::rango($fecha, $inicio, $fin);
            $bloqueoId = $bloqueos->crear($canchaId, $desde, $hasta, $this->motivo($partido));
            $this->partidos->programar($id, $canchaId, $fecha, $inicio, $bloqueoId);
        });
        responder(200, $this->detalle($this->torneos->buscarPorId((int) $partido['torneo_id'])));
    }

    // DELETE /partidos/:id/programacion  (libera la cancha)
    public function desprogramar(int $id): void
    {
        $partido = $this->verificarDelComplejo($this->partidos->buscarConDueno($id), 'El partido');
        $this->transaccion(function () use ($partido, $id) {
            if ($partido['bloqueo_id'] !== null) {
                (new Bloqueo($this->pdo))->borrar((int) $partido['bloqueo_id']);
            }
            $this->partidos->programar($id, null, null, null, null);
        });
        responder(200, $this->detalle($this->torneos->buscarPorId((int) $partido['torneo_id'])));
    }

    private function torneoPropio(int $id): array
    {
        return $this->verificarDelComplejo($this->torneos->buscarConDueno($id), 'El torneo');
    }

    // "Torneo Primavera: Los Pibes vs La Banda" (lo que se ve en la agenda)
    private function motivo(array $partido): string
    {
        $nombres = [];
        foreach (['local_id', 'visitante_id'] as $lado) {
            $equipo = $partido[$lado] !== null ? $this->equipos->buscarPorId((int) $partido[$lado]) : null;
            $nombres[] = $equipo['nombre'] ?? 'a definir';
        }
        return mb_substr("{$partido['torneo_nombre']}: {$nombres[0]} vs {$nombres[1]}", 0, Bloqueo::MOTIVO_MAXIMO);
    }

    private function detalle(array $torneo): array
    {
        $equipos = $this->equipos->listarPorTorneo((int) $torneo['id']);
        $partidos = $this->partidos->listarPorTorneo((int) $torneo['id']);
        $torneo['equipos'] = count($equipos);
        return [
            'torneo' => $this->torneos->publico($torneo),
            'equipos' => array_map([$this->equipos, 'publico'], $equipos),
            'partidos' => array_map([$this->partidos, 'publico'], $partidos),
            'tabla' => $torneo['formato'] === 'liga' ? TorneoService::tabla($equipos, $partidos) : null,
            'campeonId' => $this->servicio->campeon($torneo, $equipos, $partidos),
        ];
    }
}
