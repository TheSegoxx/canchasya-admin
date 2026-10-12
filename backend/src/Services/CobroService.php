<?php

declare(strict_types=1);

namespace App\Services;

use App\ErrorHttp;
use App\Models\Pago;
use App\Models\Turno;
use PDO;

/**
 * Cuenta de un turno: total = precio + extras; saldo = total - pagado.
 * El estado de pago (pendiente, señado, pagado) se recalcula después de cada cambio.
 * Los métodos que escriben se llaman dentro de una transacción.
 */
final class CobroService
{
    private Turno $turnos;
    private Pago $pagos;

    public function __construct(private PDO $pdo)
    {
        $this->turnos = new Turno($pdo);
        $this->pagos = new Pago($pdo);
    }

    /** @return array{total: float, pagado: float, saldo: float} */
    public function cuenta(int $turnoId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT t.precio,
                    (SELECT COALESCE(SUM(cantidad * precio_unitario), 0) FROM consumos WHERE turno_id = t.id) AS extras,
                    (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE turno_id = t.id) AS pagado
             FROM turnos t WHERE t.id = ?'
        );
        $stmt->execute([$turnoId]);
        $fila = $stmt->fetch();
        $total = round((float) $fila['precio'] + (float) $fila['extras'], 2);
        $pagado = round((float) $fila['pagado'], 2);
        return ['total' => $total, 'pagado' => $pagado, 'saldo' => round($total - $pagado, 2)];
    }

    public static function estadoPago(float $total, float $pagado): string
    {
        if ($pagado >= $total) {
            return 'pagado';
        }
        return $pagado > 0 ? 'senado' : 'pendiente';
    }

    public function actualizarEstadoPago(int $turnoId): void
    {
        $cuenta = $this->cuenta($turnoId);
        $this->turnos->cambiarEstadoPago($turnoId, self::estadoPago($cuenta['total'], $cuenta['pagado']));
    }

    // Traba el turno y controla que se le pueda cargar plata o extras
    public function trabarParaCobrar(int $turnoId): void
    {
        $turno = $this->turnos->trabar($turnoId);
        if ($turno['estado'] === 'cancelado') {
            throw new ErrorHttp(409, 'El turno está cancelado: reactivalo para cobrarle o cargarle extras');
        }
    }

    public function registrarPago(int $turnoId, float $monto, string $metodo): int
    {
        $this->trabarParaCobrar($turnoId);
        $saldo = $this->cuenta($turnoId)['saldo'];
        if ($monto > $saldo) {
            throw new ErrorHttp(409, $saldo > 0
                ? 'El pago supera lo que falta cobrar (' . pesos($saldo) . ')'
                : 'Este turno ya está pagado');
        }
        $id = $this->pagos->crear($turnoId, $monto, $metodo);
        $this->actualizarEstadoPago($turnoId);
        return $id;
    }

    /**
     * Plata que ya entró por Mercado Pago: se registra aunque supere el saldo (por ejemplo,
     * si mientras tanto pagaron en efectivo) o el turno se haya cancelado, porque el cobro
     * existe igual. Devuelve [id del pago, aviso para el dueño o null].
     *
     * @return array{0: int, 1: ?string}
     */
    public function registrarPagoMercadoPago(int $turnoId, float $monto): array
    {
        $turno = $this->turnos->trabar($turnoId);
        $saldo = $this->cuenta($turnoId)['saldo'];
        $id = $this->pagos->crear($turnoId, $monto, Pago::MERCADO_PAGO);
        $this->actualizarEstadoPago($turnoId);

        $aviso = null;
        if ($turno['estado'] === 'cancelado') {
            $aviso = 'El turno está cancelado pero el pago por Mercado Pago entró: devolvelo desde Mercado Pago o reactivá el turno.';
        } elseif ($monto > $saldo) {
            $aviso = 'Con este pago de Mercado Pago se cobró ' . pesos($monto - max($saldo, 0)) . ' de más: devolvé la diferencia.';
        }
        return [$id, $aviso];
    }
}
