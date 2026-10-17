<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Gasto u otro ingreso que el dueño carga a mano (sueldos, luz, ventas de mostrador...).
 * Lo cobrado por los turnos no va acá: sale de la tabla pagos.
 * El monto se puede repartir entre varias categorías (tabla movimiento_categorias);
 * movimientos.categoria guarda la principal, la de mayor monto.
 */
final class Movimiento extends Modelo
{
    protected string $tabla = 'movimientos';

    public const TIPOS = ['ingreso', 'egreso'];

    // Claves de categoría por tipo (los nombres para mostrar están en la app)
    public const CATEGORIAS = [
        'egreso' => ['sueldos', 'servicios', 'alquiler', 'mantenimiento', 'compras', 'impuestos', 'otros'],
        'ingreso' => ['ventas', 'eventos', 'otros'],
    ];

    // Con su reparto por categoría (columna "partes", ver publico())
    public function listarPorRango(int $complejoId, string $desde, string $hasta): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM movimientos WHERE complejo_id = ? AND fecha BETWEEN ? AND ? ORDER BY fecha DESC, id DESC'
        );
        $stmt->execute([$complejoId, $desde, $hasta]);
        return $this->conPartes($stmt->fetchAll());
    }

    public function buscarConPartes(int $id): ?array
    {
        $movimiento = $this->buscarPorId($id);
        return $movimiento !== null ? $this->conPartes([$movimiento])[0] : null;
    }

    // Sumas por día, tipo, medio de pago y categoría (para armar el dashboard)
    public function sumasPorDia(int $complejoId, string $desde, string $hasta): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT m.fecha, m.tipo, m.metodo, mc.categoria, SUM(mc.monto) AS total
             FROM movimientos m JOIN movimiento_categorias mc ON mc.movimiento_id = m.id
             WHERE m.complejo_id = ? AND m.fecha BETWEEN ? AND ?
             GROUP BY m.fecha, m.tipo, m.metodo, mc.categoria'
        );
        $stmt->execute([$complejoId, $desde, $hasta]);
        return $stmt->fetchAll();
    }

    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT m.*, x.usuario_id FROM movimientos m JOIN complejos x ON x.id = m.complejo_id WHERE m.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    /**
     * @param array{tipo: string, partes: list<array{categoria: string, monto: float}>, descripcion: ?string, metodo: string, fecha: string} $datos
     * Va dentro de una transacción (son dos tablas).
     */
    public function crear(int $complejoId, array $datos): int
    {
        $partes = $datos['partes'];
        usort($partes, fn (array $a, array $b) => $b['monto'] <=> $a['monto']);
        $id = $this->insertar([
            'complejo_id' => $complejoId,
            'tipo' => $datos['tipo'],
            'categoria' => $partes[0]['categoria'],
            'descripcion' => $datos['descripcion'],
            'monto' => round(array_sum(array_column($partes, 'monto')), 2),
            'metodo' => $datos['metodo'],
            'fecha' => $datos['fecha'],
        ]);
        $stmt = $this->pdo->prepare('INSERT INTO movimiento_categorias (movimiento_id, categoria, monto) VALUES (?, ?, ?)');
        foreach ($partes as $parte) {
            $stmt->execute([$id, $parte['categoria'], $parte['monto']]);
        }
        return $id;
    }

    public function borrar(int $id): void
    {
        $this->pdo->prepare('DELETE FROM movimientos WHERE id = ?')->execute([$id]);
    }

    // Agrega a cada movimiento su reparto por categoría (de mayor a menor monto)
    private function conPartes(array $movimientos): array
    {
        if ($movimientos === []) {
            return [];
        }
        $ids = array_column($movimientos, 'id');
        $stmt = $this->pdo->prepare(
            'SELECT movimiento_id, categoria, monto FROM movimiento_categorias
             WHERE movimiento_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')
             ORDER BY monto DESC, id'
        );
        $stmt->execute($ids);
        $porMovimiento = [];
        foreach ($stmt->fetchAll() as $fila) {
            $porMovimiento[$fila['movimiento_id']][] = ['categoria' => $fila['categoria'], 'monto' => (float) $fila['monto']];
        }
        return array_map(fn (array $m) => [...$m, 'partes' => $porMovimiento[$m['id']] ?? []], $movimientos);
    }

    public function publico(array $movimiento): array
    {
        return [
            'id' => (int) $movimiento['id'],
            'tipo' => $movimiento['tipo'],
            // La principal; el reparto completo está en "categorias"
            'categoria' => $movimiento['categoria'],
            'categorias' => $movimiento['partes'] ?? [],
            'descripcion' => $movimiento['descripcion'],
            'monto' => (float) $movimiento['monto'],
            'metodo' => $movimiento['metodo'],
            'fecha' => $movimiento['fecha'],
        ];
    }
}
