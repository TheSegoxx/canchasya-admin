<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Turno de una cancha en una fecha y horario, a nombre de un cliente.
 * Lo carga el complejo o lo reserva un jugador desde la app (usuario_id); la reserva
 * puede pedir una seña que hay que pagar antes de sena_vence_en.
 * Las horas se guardan como "HH:MM:SS"; la de fin puede ser "24:00:00".
 * El jugador se lee como jugador_id para no pisarse con el usuario_id del dueño del complejo.
 */
final class Turno extends Modelo
{
    protected string $tabla = 'turnos';

    public const ESTADOS = ['confirmado', 'cancelado', 'jugado'];

    public const ESTADOS_PAGO = ['pendiente', 'senado', 'pagado'];

    // Reserva del jugador: el turno con la cancha y lo que el jugador necesita del complejo
    private const CON_RESERVA =
        'SELECT t.*, t.usuario_id AS jugador_id, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono,
                (SELECT COALESCE(SUM(co.cantidad * co.precio_unitario), 0) FROM consumos co WHERE co.turno_id = t.id) AS extras,
                (SELECT COALESCE(SUM(p.monto), 0) FROM pagos p WHERE p.turno_id = t.id) AS pagado,
                c.nombre AS cancha_nombre, c.deporte AS cancha_deporte, c.complejo_id,
                x.nombre AS complejo_nombre, x.direccion AS complejo_direccion, x.ciudad AS complejo_ciudad,
                x.telefono AS complejo_telefono, x.latitud AS complejo_latitud, x.longitud AS complejo_longitud,
                x.cancelacion_horas
         FROM turnos t
         JOIN clientes cl ON cl.id = t.cliente_id
         JOIN canchas c ON c.id = t.cancha_id
         JOIN complejos x ON x.id = c.complejo_id';

    // Confirmado, con seña y todavía sin pagarla entera (si vence así, la reserva se cancela sola)
    private const SENA_SIN_PAGAR =
        "t.estado = 'confirmado' AND t.sena IS NOT NULL
         AND (SELECT COALESCE(SUM(p.monto), 0) FROM pagos p WHERE p.turno_id = t.id) < t.sena";

    // Lo que suman los extras y lo que ya se pagó de la cuenta del turno
    private const TOTALES =
        '(SELECT COALESCE(SUM(co.cantidad * co.precio_unitario), 0) FROM consumos co WHERE co.turno_id = t.id) AS extras,
         (SELECT COALESCE(SUM(p.monto), 0) FROM pagos p WHERE p.turno_id = t.id) AS pagado';

    // El turno con los datos de su cliente
    private const CON_CLIENTE =
        'SELECT t.*, t.usuario_id AS jugador_id, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono, ' . self::TOTALES . '
         FROM turnos t JOIN clientes cl ON cl.id = t.cliente_id';

    // Turnos confirmados de todos los complejos que empiezan entre $desde y $hasta ("AAAA-MM-DD HH:MM:SS")
    // y todavía deben algo (para el recordatorio)
    public function porEmpezarSinPagar(string $desde, string $hasta): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT t.*, cl.nombre AS cliente_nombre, " . self::TOTALES . ",
                    c.nombre AS cancha_nombre, c.complejo_id
             FROM turnos t
             JOIN clientes cl ON cl.id = t.cliente_id
             JOIN canchas c ON c.id = t.cancha_id
             WHERE t.fecha IN (?, ?) AND t.estado = 'confirmado' AND t.estado_pago <> 'pagado'
               AND TIMESTAMP(t.fecha, t.hora_inicio) > ? AND TIMESTAMP(t.fecha, t.hora_inicio) <= ?"
        );
        $stmt->execute([substr($desde, 0, 10), substr($hasta, 0, 10), $desde, $hasta]);
        return $stmt->fetchAll();
    }

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
            'SELECT t.*, t.usuario_id AS jugador_id, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono, ' . self::TOTALES . ',
                    c.nombre AS cancha_nombre, c.deporte AS cancha_deporte, c.complejo_id,
                    x.nombre AS complejo_nombre, x.direccion AS complejo_direccion, x.usuario_id,
                    x.latitud AS complejo_latitud, x.longitud AS complejo_longitud
             FROM turnos t
             JOIN clientes cl ON cl.id = t.cliente_id
             JOIN canchas c ON c.id = t.cancha_id
             JOIN complejos x ON x.id = c.complejo_id
             WHERE t.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    // Las reservas de un jugador, de la más nueva a la más vieja, con su complejo y cancha
    public function listarDelJugador(int $usuarioId, int $limite = 60): array
    {
        $stmt = $this->pdo->prepare(
            self::CON_RESERVA . " WHERE t.usuario_id = ? ORDER BY t.fecha DESC, t.hora_inicio DESC LIMIT $limite"
        );
        $stmt->execute([$usuarioId]);
        return $stmt->fetchAll();
    }

    // Una reserva con su complejo y cancha (para el jugador)
    public function buscarReserva(int $id): ?array
    {
        $stmt = $this->pdo->prepare(self::CON_RESERVA . ' WHERE t.id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Reservas cuya seña venció sin pagarse (de un complejo, de un jugador o de todos).
     *
     * @return list<int>
     */
    public function senasVencidas(?int $complejoId = null, ?int $usuarioId = null): array
    {
        $sql = 'SELECT t.id FROM turnos t JOIN canchas c ON c.id = t.cancha_id
                WHERE t.sena_vence_en < ? AND ' . self::SENA_SIN_PAGAR;
        $valores = [date('Y-m-d H:i:s')];
        if ($complejoId !== null) {
            $sql .= ' AND c.complejo_id = ?';
            $valores[] = $complejoId;
        }
        if ($usuarioId !== null) {
            $sql .= ' AND t.usuario_id = ?';
            $valores[] = $usuarioId;
        }
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($valores);
        return array_map('intval', $stmt->fetchAll(\PDO::FETCH_COLUMN));
    }

    // Cancela la reserva si la seña sigue sin pagarse. True si la canceló.
    public function cancelarSiNoPagoLaSena(int $id): bool
    {
        $stmt = $this->pdo->prepare("UPDATE turnos t SET t.estado = 'cancelado' WHERE t.id = ? AND " . self::SENA_SIN_PAGAR);
        $stmt->execute([$id]);
        return $stmt->rowCount() === 1;
    }

    // Reservas futuras y activas del jugador que todavía no tienen ningún pago
    public function reservasSinPagar(int $usuarioId): int
    {
        $stmt = $this->pdo->prepare(
            "SELECT COUNT(*) FROM turnos t
             WHERE t.usuario_id = ? AND t.estado = 'confirmado' AND TIMESTAMP(t.fecha, t.hora_inicio) > ?
               AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.turno_id = t.id)"
        );
        $stmt->execute([$usuarioId, date('Y-m-d H:i:s')]);
        return (int) $stmt->fetchColumn();
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

    /** @return list<int> Turnos del fijo desde esa fecha (para anular sus links de pago al darlo de baja) */
    public function idsDelFijoDesde(int $turnoFijoId, string $desde): array
    {
        $stmt = $this->pdo->prepare('SELECT id FROM turnos WHERE turno_fijo_id = ? AND fecha >= ?');
        $stmt->execute([$turnoFijoId, $desde]);
        return array_map('intval', $stmt->fetchAll(\PDO::FETCH_COLUMN));
    }

    public function existeDelFijo(int $turnoFijoId, string $fecha): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM turnos WHERE turno_fijo_id = ? AND fecha = ?');
        $stmt->execute([$turnoFijoId, $fecha]);
        return (bool) $stmt->fetchColumn();
    }

    /**
     * Las reservas de la app traen además usuarioId, sena y senaVenceEn.
     *
     * @param array{canchaId: int, clienteId: int, turnoFijoId: ?int, fecha: string, horaInicio: string, horaFin: string, precio: float, usuarioId?: int, sena?: ?float, senaVenceEn?: ?string} $datos
     */
    public function crear(array $datos): int
    {
        return $this->insertar([
            'cancha_id' => $datos['canchaId'],
            'cliente_id' => $datos['clienteId'],
            'turno_fijo_id' => $datos['turnoFijoId'],
            'usuario_id' => $datos['usuarioId'] ?? null,
            'fecha' => $datos['fecha'],
            'hora_inicio' => $datos['horaInicio'],
            'hora_fin' => $datos['horaFin'],
            'precio' => $datos['precio'],
            'sena' => $datos['sena'] ?? null,
            'sena_vence_en' => $datos['senaVenceEn'] ?? null,
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

    // Confirmado, con seña y todavía sin pagarla entera
    public static function senaPendiente(array $turno): bool
    {
        return $turno['estado'] === 'confirmado' && $turno['sena'] !== null && $turno['sena_vence_en'] !== null
            && (float) $turno['pagado'] < (float) $turno['sena'];
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
            // Reservado por un jugador desde la app (si no, lo cargó el complejo)
            'reservaApp' => ($turno['jugador_id'] ?? null) !== null,
            // La seña que pidió el complejo y, mientras falte pagarla, hasta cuándo hay tiempo
            'sena' => $turno['sena'] !== null ? (float) $turno['sena'] : null,
            'senaVenceEn' => self::senaPendiente($turno) ? substr($turno['sena_vence_en'], 0, 16) : null,
            'cliente' => [
                'id' => (int) $turno['cliente_id'],
                'nombre' => $turno['cliente_nombre'],
                'telefono' => $turno['cliente_telefono'],
            ],
        ];
    }
}
