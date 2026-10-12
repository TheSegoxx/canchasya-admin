<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Extra cargado a la cuenta de un turno. La descripción y el precio se copian
 * del producto al cargarlo: si después cambia el precio, la cuenta no cambia.
 */
final class Consumo extends Modelo
{
    protected string $tabla = 'consumos';

    public function listarPorTurno(int $turnoId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM consumos WHERE turno_id = ? ORDER BY id');
        $stmt->execute([$turnoId]);
        return $stmt->fetchAll();
    }

    // Con el dueño del complejo y el estado del turno, para controlar acceso y si se puede borrar
    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT co.*, t.estado AS turno_estado, x.usuario_id FROM consumos co
             JOIN turnos t ON t.id = co.turno_id
             JOIN canchas c ON c.id = t.cancha_id
             JOIN complejos x ON x.id = c.complejo_id
             WHERE co.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function crear(int $turnoId, ?int $productoId, string $descripcion, int $cantidad, float $precioUnitario): int
    {
        return $this->insertar([
            'turno_id' => $turnoId,
            'producto_id' => $productoId,
            'descripcion' => $descripcion,
            'cantidad' => $cantidad,
            'precio_unitario' => $precioUnitario,
        ]);
    }

    public function borrar(int $id): void
    {
        $this->pdo->prepare('DELETE FROM consumos WHERE id = ?')->execute([$id]);
    }

    public function publico(array $consumo): array
    {
        $precio = (float) $consumo['precio_unitario'];
        return [
            'id' => (int) $consumo['id'],
            'descripcion' => $consumo['descripcion'],
            'cantidad' => (int) $consumo['cantidad'],
            'precioUnitario' => $precio,
            'subtotal' => round($precio * (int) $consumo['cantidad'], 2),
        ];
    }
}
