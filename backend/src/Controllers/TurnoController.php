<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ErrorHttp;
use App\Models\Cancha;
use App\Models\Cliente;
use App\Models\Turno;
use App\Models\TurnoFijo;
use App\Services\AgendaService;
use App\Services\CobroService;
use App\Services\LinksDePago;
use App\Services\VistaTurno;

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
     * {canchaId, fecha, horaInicio, clienteId | cliente: {nombre, telefono}, precio?, fijo?, sena?: {monto, metodo}}
     * Sin precio se usa el de la franja horaria. Con fijo = true se repite todas las semanas.
     * Con sena se registra el primer pago en el mismo momento.
     */
    public function crear(): void
    {
        $complejo = $this->complejoActual();
        $complejoId = (int) $complejo['id'];
        $datos = leerJson();

        $cancha = $this->verificarDelComplejo(
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
        if ($precio !== null && $this->esEmpleado()) {
            responder(403, ['error' => 'Solo el dueño puede cambiar el precio de un turno']);
        }
        $esFijo = booleanoOpcional($datos, 'fijo', 'fijo');
        $cliente = $this->clienteDeLaPeticion($datos);
        $sena = $this->senaDeLaPeticion($datos);

        [$turnoId, $ocupadas] = $this->transaccion(function () use (
            $complejoId, $cancha, $canchaId, $fecha, $inicio, $fin, $precio, $esFijo, $cliente, $sena
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
            $cobros = new CobroService($this->pdo);
            if ($sena !== null) {
                $cobros->registrarPago($id, $sena['monto'], $sena['metodo']);
            } else {
                // Un turno sin cargo queda pagado desde el principio
                $cobros->actualizarEstadoPago($id);
            }
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
        $this->verificarDelComplejo($this->turnos->buscarDetalle($id), 'El turno');
        responder(200, ['turno' => $this->detalle($id)]);
    }

    // PATCH /turnos/:id/estado  {estado: "confirmado"|"cancelado"|"jugado"}
    public function cambiarEstado(int $id): void
    {
        $turno = $this->verificarDelComplejo($this->turnos->buscarDetalle($id), 'El turno');
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
            if ($estado === 'cancelado') {
                (new LinksDePago($this->pdo))->anularDeTurnosCancelados([$id]);
            }
        }
        responder(200, ['turno' => $this->detalle($id)]);
    }

    // GET /turnos-fijos  (los vigentes)
    public function listarFijos(): void
    {
        $complejoId = (int) $this->complejoActual()['id'];
        responder(200, ['turnosFijos' => array_map([$this->fijos, 'publico'], $this->fijos->listarVigentes($complejoId))]);
    }

    /**
     * PATCH /turnos-fijos/:id/baja  {desde: "AAAA-MM-DD"}
     * El fijo deja de repetirse a partir de esa fecha y se cancelan sus turnos ya creados.
     */
    public function darDeBajaFijo(int $id): void
    {
        $fijo = $this->verificarDelComplejo($this->fijos->buscarConDueno($id), 'El turno fijo');
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
        (new LinksDePago($this->pdo))->anularDeTurnosCancelados($this->turnos->idsDelFijoDesde($id, $desde));

        $respuesta = ['ok' => true];
        if ($conPago > 0) {
            $respuesta['aviso'] = $conPago === 1
                ? 'Quedó 1 turno sin cancelar porque ya tiene un pago registrado.'
                : "Quedaron $conPago turnos sin cancelar porque ya tienen un pago registrado.";
        }
        responder(200, $respuesta);
    }

    // El turno con su cancha, complejo, turno fijo y cuenta, como lo muestra la app
    private function detalle(int $id): array
    {
        return (new VistaTurno($this->pdo))->detalle($id);
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
            $cliente = $this->verificarDelComplejo(
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

    /** @return array{monto: float, metodo: string}|null */
    private function senaDeLaPeticion(array $datos): ?array
    {
        $sena = $datos['sena'] ?? null;
        if ($sena === null) {
            return null;
        }
        if (!is_array($sena)) {
            responder(400, ['error' => 'La seña no tiene el formato correcto']);
        }
        return pagoValido($sena);
    }

    // Si ya hay un cliente con ese teléfono se usa ese (no se duplica la persona)
    private function clienteId(int $complejoId, array $cliente): int
    {
        if (isset($cliente['id'])) {
            return $cliente['id'];
        }
        $existente = $this->clientes->buscarPorTelefono($complejoId, $cliente['telefono']);
        if ($existente !== null) {
            return (int) $existente['id'];
        }
        try {
            return $this->clientes->crear($complejoId, $cliente['nombre'], $cliente['telefono']);
        } catch (\PDOException $e) {
            // Otra reserva creó el mismo cliente en ese instante (teléfono único): se usa ese
            $otro = $e->getCode() === '23000'
                ? $this->clientes->buscarPorTelefono($complejoId, $cliente['telefono'])
                : null;
            if ($otro === null) {
                throw $e;
            }
            return (int) $otro['id'];
        }
    }
}
