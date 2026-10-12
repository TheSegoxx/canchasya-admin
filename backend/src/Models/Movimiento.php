<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Gasto u otro ingreso que el dueño carga a mano (sueldos, luz, ventas de mostrador...).
 * Lo cobrado por los turnos no va acá: sale de la tabla pagos.
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

    public function listarPorRango(int $complejoId, string $desde, string $hasta): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM movimientos WHERE complejo_id = ? AND fecha BETWEEN ? AND ? ORDER BY fecha DESC, id DESC'
        );
        $stmt->execute([$complejoId, $desde, $hasta]);
        return $stmt->fetchAll();
    }

    // Sumas por día, tipo, medio de pago y categoría (para armar el dashboard)
    public function sumasPorDia(int $complejoId, string $desde, string $hasta): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT fecha, tipo, metodo, categoria, SUM(monto) AS total FROM movimientos
             WHERE complejo_id = ? AND fecha BETWEEN ? AND ?
             GROUP BY fecha, tipo, metodo, categoria'
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

    public function crear(int $complejoId, array $datos): int
    {
        return $this->insertar(['complejo_id' => $complejoId, ...$datos]);
    }

    public function borrar(int $id): void
    {
        $this->pdo->prepare('DELETE FROM movimientos WHERE id = ?')->execute([$id]);
    }

    public function publico(array $movimiento): array
    {
        return [
            'id' => (int) $movimiento['id'],
            'tipo' => $movimiento['tipo'],
            'categoria' => $movimiento['categoria'],
            'descripcion' => $movimiento['descripcion'],
            'monto' => (float) $movimiento['monto'],
            'metodo' => $movimiento['metodo'],
            'fecha' => $movimiento['fecha'],
        ];
    }
}
