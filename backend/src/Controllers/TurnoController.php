<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ErrorHttp;
use App\Models\Cancha;
use App\Models\Cliente;
use App\Models\Turno;
use App\Models\TurnoFijo;
use App\Services\AgendaService;

/**
 * Endpoints /turnos y /turnos-fijos: reservar, ver, cancelar y dar de baja turnos fijos.
 */
final class TurnoController extends Controlador
{
    // Cambios de estado permitidos: de => [a]
    private const TRANSICIONES = [
        'confirmado' => ['cancelado', 'jugado'],
        'cancelado' => ['confirmado'],
        'jugado' => ['confirmado'],
    ];

    private Turno $turnos;
    private TurnoFijo $fijos;
    private Cliente $clientes;
    private Cancha $canchas;
    private AgendaService $agenda;

    public function __construct()
    {
        parent::__construct();
        $this->turnos = new Turno($this->pdo);
        $this->fijos = new TurnoFijo($this->pdo);
        $this->clientes = new Cliente($this->pdo);
        $this->canchas = new Cancha($this->pdo);
        $this->agenda = new AgendaService($this->pdo);
    }

    /**
     * POST /turnos
     * {canchaId, fecha, horaInicio, clienteId | cliente: {nombre, telefono}, precio?, fijo?}
     * Sin precio se usa el de la franja horaria. Con fijo = true se repite todas las semanas.
     */
    public function crear(): void
    {
        $complejo = $this->complejoDelDueno();
        $complejoId = (int) $complejo['id'];
        $datos = leerJson();

        $cancha = $this->verificarDueno(
            $this->canchas->buscarConDueno(idRequerido($datos, 'canchaId', 'la cancha')),
            'La cancha'
        );
        $canchaId = (int) $cancha['id'];
        if (!$cancha['habilitada']) {
            responder(409, ['error' => 'La cancha está deshabilitada. Habilitala para cargarle turnos.']);
        }

        $fecha = fechaRequerida($datos, 'fecha', 'la fecha');
        if ($fecha < hoy()) {
            responder(400, ['error' => 'No se pueden cargar turnos en días que ya pasaron']);
        }
        $inicio = horaRequerida($datos, 'horaInicio', 'la hora del turno');
        $fin = $this->horaFin($complejo, $cancha, $inicio);
        $precio = ($datos['precio'] ?? null) !== null ? precioRequerido($datos, 'precio', 'el precio') : null;
        $esFijo = booleanoOpcional($datos, 'fijo', 'fijo');
        $cliente = $this->clienteDeLaPeticion($datos);

        [$turnoId, $ocupadas] = $this->transaccion(function () use (
            $complejoId, $cancha, $canchaId, $fecha, $inicio, $fin, $precio, $esFijo, $cliente
        ) {
            $this->agenda->trabarCancha($canchaId);
            // Así un turno fijo de ese día cuenta como ocupado aunque nadie haya abierto la agenda
            $this->agenda->materializarFijos($complejoId, $fecha, $canchaId);
            $this->agenda->verificarLibre($canchaId, $fecha, $inicio, $fin);
            $clienteId = $this->clienteId($complejoId, $cliente);

            $fijoId = null;
            $ocupadas = [];
            if ($esFijo) {
                $dia = diaDeLaSemana($fecha);
                $otro = $this->fijos->enConflicto($canchaId, $dia, $inicio, $fin, $fecha);
                if ($otro !== null) {
                    throw new ErrorHttp(409, sprintf(
                        'Ese horario ya es el turno fijo de %s los %s',
                        $otro['cliente_nombre'],
                        diaEnPlural($dia)
                    ));
                }
                $fijoId = $this->fijos->crear([
                    'canchaId' => $canchaId,
                    'clienteId' => $clienteId,
                    'fecha' => $fecha,
                    'horaInicio' => $inicio,
                    'horaFin' => $fin,
                    'precio' => $precio,
                ]);
                // Las semanas que ya están reservadas por otro se saltean: se avisa cuáles
                foreach ($this->turnos->superpuestosEnSemanas($canchaId, $fecha, $dia, $inicio, $fin) as $t) {
                    $ocupadas[] = fechaCorta($t['fecha']) . " ({$t['cliente_nombre']})";
                }
            }

            $id = $this->turnos->crear([
                'canchaId' => $canchaId,
                'clienteId' => $clienteId,
                'turnoFijoId' => $fijoId,
                'fecha' => $fecha,
                'horaInicio' => $inicio,
                'horaFin' => $fin,
                'precio' => $precio ?? $this->agenda->precio($cancha, $inicio),
            ]);
            return [$id, $ocupadas];
        });

        $respuesta = ['turno' => $this->detalle($turnoId)];
        if ($ocupadas !== []) {
            $respuesta['aviso'] = 'Esas semanas el horario ya estaba reservado, así que no se le guarda: '
                . implode(', ', $ocupadas);
        }
        responder(201, $respuesta);
    }

    // GET /turnos/:id
    public function obtener(int $id): void
    {
        $this->verificarDueno($this->turnos->buscarDetalle($id), 'El turno');
        responder(200, ['turno' => $this->detalle($id)]);
    }

    // PATCH /turnos/:id/estado  {estado: "confirmado"|"cancelado"|"jugado"}
    public function cambiarEstado(int $id): void
    {
        $turno = $this->verificarDueno($this->turnos->buscarDetalle($id), 'El turno');
        $estado = textoDe(leerJson(), 'estado');
        if (!in_array($estado, Turno::ESTADOS, true)) {
            responder(400, ['error' => 'El estado tiene que ser confirmado, cancelado o jugado']);
        }
        $actual = $turno['estado'];
        if ($estado !== $actual && !in_array($estado, self::TRANSICIONES[$actual], true)) {
            responder(409, ['error' => "Un turno $actual no puede pasar a $estado"]);
        }

        // Volver a confirmar un cancelado: el horario puede haberse ocupado mientras tanto
        if ($actual === 'cancelado' && $estado === 'confirmado') {
            if ($turno['fecha'] < hoy()) {
                responder(409, ['error' => 'No se puede reactivar un turno de un día que ya pasó']);
            }
            $this->transaccion(function () use ($turno, $id) {
                $canchaId = (int) $turno['cancha_id'];
                $this->agenda->trabarCancha($canchaId);
                $this->agenda->verificarLibre($canchaId, $turno['fecha'], $turno['hora_inicio'], $turno['hora_fin'], $id);
                $this->turnos->cambiarEstado($id, 'confirmado');
            });
        } elseif ($estado !== $actual) {
            $this->turnos->cambiarEstado($id, $estado);
        }
        responder(200, ['turno' => $this->detalle($id)]);
    }

    // GET /turnos-fijos  (los vigentes)
    public function listarFijos(): void
    {
        $complejoId = (int) $this->complejoDelDueno()['id'];
        responder(200, ['turnosFijos' => array_map([$this->fijos, 'publico'], $this->fijos->listarVigentes($complejoId))]);
    }

    /**
     * PATCH /turnos-fijos/:id/baja  {desde: "AAAA-MM-DD"}
     * El fijo deja de repetirse a partir de esa fecha y se cancelan sus turnos ya creados.
     */
    public function darDeBajaFijo(int $id): void
    {
        $fijo = $this->verificarDueno($this->fijos->buscarConDueno($id), 'El turno fijo');
        $desde = fechaRequerida(leerJson(), 'desde', 'la fecha desde la que se da de baja');
        if ($desde < hoy()) {
            responder(400, ['error' => 'La baja tiene que ser desde hoy en adelante']);
        }
        if ($fijo['fecha_hasta'] !== null && $fijo['fecha_hasta'] < $desde) {
            responder(409, ['error' => 'Ese turno fijo ya estaba dado de baja']);
        }

        $conPago = $this->transaccion(function () use ($id, $desde) {
            $this->fijos->terminar($id, sumarDias($desde, -1));
            return $this->turnos->cancelarDelFijo($id, $desde);
        });

        $respuesta = ['ok' => true];
        if ($conPago > 0) {
            $respuesta['aviso'] = $conPago === 1
                ? 'Quedó 1 turno sin cancelar porque ya tiene un pago registrado.'
                : "Quedaron $conPago turnos sin cancelar porque ya tienen un pago registrado.";
        }
        responder(200, $respuesta);
    }

    // El turno con su cancha, complejo y turno fijo, como lo muestra la app
    private function detalle(int $id): array
    {
        $fila = $this->turnos->buscarDetalle($id);
        $fijo = $fila['turno_fijo_id'] !== null ? $this->fijos->buscarPorId((int) $fila['turno_fijo_id']) : null;
        return [
            ...$this->turnos->publico($fila),
            'cancha' => ['id' => (int) $fila['cancha_id'], 'nombre' => $fila['cancha_nombre'], 'deporte' => $fila['cancha_deporte']],
            'complejo' => ['nombre' => $fila['complejo_nombre'], 'direccion' => $fila['complejo_direccion']],
            'fijo' => $fijo !== null ? [
                'id' => (int) $fijo['id'],
                'diaSemana' => (int) $fijo['dia_semana'],
                'fechaHasta' => $fijo['fecha_hasta'],
            ] : null,
        ];
    }

    // El turno dura lo que la cancha y tiene que entrar en el horario del complejo
    private function horaFin(array $complejo, array $cancha, string $inicio): string
    {
        $fin = minutosDe($inicio) + (int) $cancha['duracion_min'];
        if ($inicio < $complejo['hora_apertura'] || $fin > minutosDe($complejo['hora_cierre'])) {
            responder(400, ['error' => sprintf(
                'Un turno de %d minutos a esa hora queda fuera del horario del complejo (%s a %s)',
                $cancha['duracion_min'],
                horaCorta($complejo['hora_apertura']),
                horaCorta($complejo['hora_cierre'])
            )]);
        }
        return horaDe($fin);
    }

    /**
     * El cliente puede venir como id (uno ya cargado) o con nombre y teléfono (nuevo).
     *
     * @return array{id: int}|array{nombre: string, telefono: string}
     */
    private function clienteDeLaPeticion(array $datos): array
    {
        if (isset($datos['clienteId'])) {
            $cliente = $this->verificarDueno(
                $this->clientes->buscarConDueno(idRequerido($datos, 'clienteId', 'el cliente')),
                'El cliente'
            );
            return ['id' => (int) $cliente['id']];
        }

        $nuevo = $datos['cliente'] ?? null;
        if (!is_array($nuevo)) {
            responder(400, ['error' => 'Falta el cliente del turno']);
        }
        $telefono = normalizarTelefono(textoDe($nuevo, 'telefono'));
        if ($telefono === null) {
            responder(400, ['error' => 'El teléfono del cliente no es válido. Escribilo con el código de área (por ejemplo, 11 5555 1234).']);
        }
        return ['nombre' => textoRequerido($nuevo, 'nombre', 100, 'el nombre del cliente'), 'telefono' => $telefono];
    }

    // Si ya hay un cliente con ese teléfono se usa ese (no se duplica la persona)
    private function clienteId(int $complejoId, array $cliente): int
    {
        if (isset($cliente['id'])) {
            return $cliente['id'];
        }
        $existente = $this->clientes->buscarPorTelefono($complejoId, $cliente['telefono']);
        return $existente !== null
            ? (int) $existente['id']
            : $this->clientes->crear($complejoId, $cliente['nombre'], $cliente['telefono']);
    }
}
