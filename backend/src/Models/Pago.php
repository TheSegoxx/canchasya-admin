<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Plata que entró por un turno: una seña, el saldo o el total.
 */
final class Pago extends Modelo
{
    protected string $tabla = 'pagos';

    // Los que el dueño carga a mano; 'mercadopago' lo registra solo la API al aprobarse un link
    public const METODOS = ['efectivo', 'transferencia'];
    public const MERCADO_PAGO = 'mercadopago';

    /**
     * Qué fue cada pago, según lo que el turno debía cuando entró:
     * sena = el primero sin completar; total = el primero y completa; saldo = completa lo que faltaba;
     * parcial = uno del medio.
     */
    public static function concepto(float $total, float $pagadoAntes, float $monto): string
    {
        $completa = $pagadoAntes + $monto >= $total;
        if ($pagadoAntes <= 0) {
            return $completa ? 'total' : 'sena';
        }
        return $completa ? 'saldo' : 'parcial';
    }

    public function listarPorTurno(int $turnoId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM pagos WHERE turno_id = ? ORDER BY fecha_pago, id');
        $stmt->execute([$turnoId]);
        return $stmt->fetchAll();
    }

    // Lo cobrado en el día (según cuándo entró la plata, no la fecha del turno)
    public function listarPorDia(int $complejoId, string $fecha): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT p.*, t.fecha AS turno_fecha, t.hora_inicio, c.nombre AS cancha_nombre, cl.nombre AS cliente_nombre
             FROM pagos p
             JOIN turnos t ON t.id = p.turno_id
             JOIN canchas c ON c.id = t.cancha_id
             JOIN clientes cl ON cl.id = t.cliente_id
             WHERE c.complejo_id = ? AND p.fecha_pago >= ? AND p.fecha_pago < ?
             ORDER BY p.fecha_pago DESC, p.id DESC'
        );
        $stmt->execute([$complejoId, "$fecha 00:00:00", sumarDias($fecha, 1) . ' 00:00:00']);
        return $stmt->fetchAll();
    }

    // Lo cobrado por día y medio de pago en un rango (para el dashboard)
    public function sumasPorDia(int $complejoId, string $desde, string $hasta): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT DATE(p.fecha_pago) AS dia, p.metodo, SUM(p.monto) AS total
             FROM pagos p
             JOIN turnos t ON t.id = p.turno_id
             JOIN canchas c ON c.id = t.cancha_id
             WHERE c.complejo_id = ? AND p.fecha_pago >= ? AND p.fecha_pago < ?
             GROUP BY dia, p.metodo'
        );
        $stmt->execute([$complejoId, "$desde 00:00:00", sumarDias($hasta, 1) . ' 00:00:00']);
        return $stmt->fetchAll();
    }

    // Lo cobrado en el rango, por cancha (de la que más recaudó a la que menos)
    public function sumasPorCancha(int $complejoId, string $desde, string $hasta): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT c.id, c.nombre, SUM(p.monto) AS total
             FROM pagos p
             JOIN turnos t ON t.id = p.turno_id
             JOIN canchas c ON c.id = t.cancha_id
             WHERE c.complejo_id = ? AND p.fecha_pago >= ? AND p.fecha_pago < ?
             GROUP BY c.id, c.nombre
             ORDER BY total DESC'
        );
        $stmt->execute([$complejoId, "$desde 00:00:00", sumarDias($hasta, 1) . ' 00:00:00']);
        return $stmt->fetchAll();
    }

    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT p.*, x.usuario_id FROM pagos p
             JOIN turnos t ON t.id = p.turno_id
             JOIN canchas c ON c.id = t.cancha_id
             JOIN complejos x ON x.id = c.complejo_id
             WHERE p.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function crear(int $turnoId, float $monto, string $metodo, string $concepto): int
    {
        return $this->insertar(['turno_id' => $turnoId, 'monto' => $monto, 'metodo' => $metodo, 'concepto' => $concepto]);
    }

    public function borrar(int $id): void
    {
        $this->pdo->prepare('DELETE FROM pagos WHERE id = ?')->execute([$id]);
    }

    public function publico(array $pago): array
    {
        return [
            'id' => (int) $pago['id'],
            'monto' => (float) $pago['monto'],
            'metodo' => $pago['metodo'],
            'concepto' => $pago['concepto'],
            'fecha' => substr($pago['fecha_pago'], 0, 10),
            'hora' => substr($pago['fecha_pago'], 11, 5),
        ];
    }
}
