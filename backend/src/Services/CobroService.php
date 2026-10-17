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

    /**
     * Caja de un día: lo cobrado por medio de pago y los turnos que todavía deben algo.
     * Los turnos fijos del día ya tienen que estar materializados.
     *
     * @return array{totales: array, cobros: list<array>, porCobrar: list<array>, totalPorCobrar: float}
     */
    public function caja(int $complejoId, string $fecha): array
    {
        $cobros = $this->pagos->listarPorDia($complejoId, $fecha);
        $totales = ['total' => 0.0, 'efectivo' => 0.0, 'transferencia' => 0.0, 'mercadopago' => 0.0, 'cantidad' => count($cobros)];
        foreach ($cobros as $c) {
            $totales[$c['metodo']] += (float) $c['monto'];
            $totales['total'] += (float) $c['monto'];
        }

        $porCobrar = array_values(array_filter(
            array_map(
                fn (array $t) => [...$this->turnos->publico($t), 'canchaNombre' => $t['cancha_nombre']],
                $this->turnos->listarPorFecha($complejoId, $fecha)
            ),
            fn (array $t) => $t['estado'] !== 'cancelado' && $t['pagado'] < $t['total']
        ));

        return [
            'totales' => array_map(fn ($v) => is_float($v) ? round($v, 2) : $v, $totales),
            'cobros' => $cobros,
            'porCobrar' => $porCobrar,
            'totalPorCobrar' => round(array_sum(array_map(fn ($t) => $t['total'] - $t['pagado'], $porCobrar)), 2),
        ];
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
        $cuenta = $this->cuenta($turnoId);
        $saldo = $cuenta['saldo'];
        if ($monto > $saldo) {
            throw new ErrorHttp(409, $saldo > 0
                ? 'El pago supera lo que falta cobrar (' . pesos($saldo) . ')'
                : 'Este turno ya está pagado');
        }
        $id = $this->pagos->crear($turnoId, $monto, $metodo, Pago::concepto($cuenta['total'], $cuenta['pagado'], $monto));
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
        $cuenta = $this->cuenta($turnoId);
        $saldo = $cuenta['saldo'];
        $id = $this->pagos->crear($turnoId, $monto, Pago::MERCADO_PAGO, Pago::concepto($cuenta['total'], $cuenta['pagado'], $monto));
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
