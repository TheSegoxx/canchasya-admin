<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Extra que el complejo vende o alquila (paletas, pelotas, bebidas).
 * No se borra: se desactiva, así los consumos viejos siguen teniendo su producto.
 */
final class Producto extends Modelo
{
    protected string $tabla = 'productos';

    public const NOMBRE_MAXIMO = 60;

    // Primero los activos, por nombre
    public function listarPorComplejo(int $complejoId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM productos WHERE complejo_id = ? ORDER BY activo DESC, nombre');
        $stmt->execute([$complejoId]);
        return $stmt->fetchAll();
    }

    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT p.*, x.usuario_id FROM productos p JOIN complejos x ON x.id = p.complejo_id WHERE p.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function nombreEnUso(int $complejoId, string $nombre, ?int $exceptoId = null): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM productos WHERE complejo_id = ? AND nombre = ? AND id <> ?');
        $stmt->execute([$complejoId, $nombre, $exceptoId ?? 0]);
        return (bool) $stmt->fetchColumn();
    }

    public function crear(int $complejoId, string $nombre, float $precio): int
    {
        return $this->insertar(['complejo_id' => $complejoId, 'nombre' => $nombre, 'precio' => $precio]);
    }

    public function editar(int $id, string $nombre, float $precio, bool $activo): void
    {
        $this->actualizar($id, ['nombre' => $nombre, 'precio' => $precio, 'activo' => (int) $activo]);
    }

    public function publico(array $producto): array
    {
        return [
            'id' => (int) $producto['id'],
            'nombre' => $producto['nombre'],
            'precio' => (float) $producto['precio'],
            'activo' => (bool) $producto['activo'],
        ];
    }
}
