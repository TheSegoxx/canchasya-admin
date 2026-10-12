<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Turno de una cancha en una fecha y horario, a nombre de un cliente.
 * Las horas se guardan como "HH:MM:SS"; la de fin puede ser "24:00:00".
 */
final class Turno extends Modelo
{
    protected string $tabla = 'turnos';

    public const ESTADOS = ['confirmado', 'cancelado', 'jugado'];

    public const ESTADOS_PAGO = ['pendiente', 'senado', 'pagado'];

    // Lo que suman los extras y lo que ya se pagó de la cuenta del turno
    private const TOTALES =
        '(SELECT COALESCE(SUM(co.cantidad * co.precio_unitario), 0) FROM consumos co WHERE co.turno_id = t.id) AS extras,
         (SELECT COALESCE(SUM(p.monto), 0) FROM pagos p WHERE p.turno_id = t.id) AS pagado';

    // El turno con los datos de su cliente
    private const CON_CLIENTE =
        'SELECT t.*, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono, ' . self::TOTALES . '
         FROM turnos t JOIN clientes cl ON cl.id = t.cliente_id';

    // Todos los turnos del día, incluidos los cancelados (la app decide cuáles mostrar)
    public function listarPorFecha(int $complejoId, string $fecha): array
    {
        $stmt = $this->pdo->prepare(
            str_replace(' FROM turnos t', ', c.nombre AS cancha_nombre FROM turnos t', self::CON_CLIENTE)
            . ' JOIN canchas c ON c.id = t.cancha_id
             WHERE c.complejo_id = ? AND t.fecha = ?
             ORDER BY t.hora_inicio, c.nombre'
        );
        $stmt->execute([$complejoId, $fecha]);
        return $stmt->fetchAll();
    }

    // Con la cancha, el complejo y su dueño (para la pantalla del turno y el control de acceso)
    public function buscarDetalle(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT t.*, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono, ' . self::TOTALES . ',
                    c.nombre AS cancha_nombre, c.deporte AS cancha_deporte,
                    x.nombre AS complejo_nombre, x.direccion AS complejo_direccion, x.usuario_id
             FROM turnos t
             JOIN clientes cl ON cl.id = t.cliente_id
             JOIN canchas c ON c.id = t.cancha_id
             JOIN complejos x ON x.id = c.complejo_id
             WHERE t.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    // Turnos activos de la cancha que se pisan con el horario pedido
    public function superpuestos(int $canchaId, string $fecha, string $inicio, string $fin, int $exceptoId = 0): array
    {
        $stmt = $this->pdo->prepare(
            self::CON_CLIENTE . "
             WHERE t.cancha_id = ? AND t.fecha = ? AND t.estado <> 'cancelado'
               AND t.hora_inicio < ? AND t.hora_fin > ? AND t.id <> ?
             ORDER BY t.hora_inicio"
        );
        $stmt->execute([$canchaId, $fecha, $fin, $inicio, $exceptoId]);
        return $stmt->fetchAll();
    }

    // Turnos activos de la cancha a partir de una fecha, en un día de la semana y horario
    // (para avisar qué fechas no va a poder ocupar un turno fijo nuevo)
    public function superpuestosEnSemanas(int $canchaId, string $desde, int $diaSemana, string $inicio, string $fin): array
    {
        $stmt = $this->pdo->prepare(
            self::CON_CLIENTE . "
             WHERE t.cancha_id = ? AND t.fecha > ? AND WEEKDAY(t.fecha) + 1 = ?
               AND t.estado <> 'cancelado' AND t.hora_inicio < ? AND t.hora_fin > ?
             ORDER BY t.fecha"
        );
        $stmt->execute([$canchaId, $desde, $diaSemana, $fin, $inicio]);
        return $stmt->fetchAll();
    }

    /**
     * Turnos reservados (no cancelados) y cancelados entre dos fechas, y los minutos de cancha reservados
     * (para el dashboard).
     *
     * @return array{reservados: int, cancelados: int, minutos: int}
     */
    public function estadisticas(int $complejoId, string $desde, string $hasta): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT COALESCE(SUM(t.estado <> 'cancelado'), 0) AS reservados,
                    COALESCE(SUM(t.estado = 'cancelado'), 0) AS cancelados,
                    COALESCE(SUM(CASE WHEN t.estado <> 'cancelado'
                        THEN (TIME_TO_SEC(t.hora_fin) - TIME_TO_SEC(t.hora_inicio)) / 60 END), 0) AS minutos
             FROM turnos t JOIN canchas c ON c.id = t.cancha_id
             WHERE c.complejo_id = ? AND t.fecha BETWEEN ? AND ?"
        );
        $stmt->execute([$complejoId, $desde, $hasta]);
        $fila = $stmt->fetch();
        return [
            'reservados' => (int) $fila['reservados'],
            'cancelados' => (int) $fila['cancelados'],
            'minutos' => (int) $fila['minutos'],
        ];
    }

    public function existeDelFijo(int $turnoFijoId, string $fecha): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM turnos WHERE turno_fijo_id = ? AND fecha = ?');
        $stmt->execute([$turnoFijoId, $fecha]);
        return (bool) $stmt->fetchColumn();
    }

    /** @param array{canchaId: int, clienteId: int, turnoFijoId: ?int, fecha: string, horaInicio: string, horaFin: string, precio: float} $datos */
    public function crear(array $datos): int
    {
        return $this->insertar([
            'cancha_id' => $datos['canchaId'],
            'cliente_id' => $datos['clienteId'],
            'turno_fijo_id' => $datos['turnoFijoId'],
            'fecha' => $datos['fecha'],
            'hora_inicio' => $datos['horaInicio'],
            'hora_fin' => $datos['horaFin'],
            'precio' => $datos['precio'],
        ]);
    }

    public function cambiarEstado(int $id, string $estado): void
    {
        $this->actualizar($id, ['estado' => $estado]);
    }

    public function cambiarEstadoPago(int $id, string $estadoPago): void
    {
        $this->actualizar($id, ['estado_pago' => $estadoPago]);
    }

    /**
     * Traba el turno hasta que termine la transacción: dos cobros a la vez
     * no pueden pasarse del saldo. Devuelve el precio y el estado.
     */
    public function trabar(int $id): array
    {
        $stmt = $this->pdo->prepare('SELECT precio, estado FROM turnos WHERE id = ? FOR UPDATE');
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    /**
     * Cancela los turnos de un fijo desde una fecha. Los que ya tienen un pago
     * no se tocan (hay plata de por medio): devuelve cuántos quedaron así.
     */
    public function cancelarDelFijo(int $turnoFijoId, string $desde): int
    {
        $this->pdo->prepare(
            "UPDATE turnos t SET t.estado = 'cancelado'
             WHERE t.turno_fijo_id = ? AND t.fecha >= ? AND t.estado = 'confirmado'
               AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.turno_id = t.id)"
        )->execute([$turnoFijoId, $desde]);

        $stmt = $this->pdo->prepare(
            "SELECT COUNT(*) FROM turnos WHERE turno_fijo_id = ? AND fecha >= ? AND estado = 'confirmado'"
        );
        $stmt->execute([$turnoFijoId, $desde]);
        return (int) $stmt->fetchColumn();
    }

    public function publico(array $turno): array
    {
        $total = round((float) $turno['precio'] + (float) $turno['extras'], 2);
        return [
            'id' => (int) $turno['id'],
            'canchaId' => (int) $turno['cancha_id'],
            'fecha' => $turno['fecha'],
            'horaInicio' => horaCorta($turno['hora_inicio']),
            'horaFin' => horaCorta($turno['hora_fin']),
            'precio' => (float) $turno['precio'],
            'estado' => $turno['estado'],
            'estadoPago' => $turno['estado_pago'],
            // Cuenta: precio del turno + extras; saldo = total - pagado
            'total' => $total,
            'pagado' => (float) $turno['pagado'],
            'turnoFijoId' => $turno['turno_fijo_id'] !== null ? (int) $turno['turno_fijo_id'] : null,
            'cliente' => [
                'id' => (int) $turno['cliente_id'],
                'nombre' => $turno['cliente_nombre'],
                'telefono' => $turno['cliente_telefono'],
            ],
        ];
    }
}
