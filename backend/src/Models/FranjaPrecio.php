<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Precio especial de una cancha en un rango horario (por ejemplo, la noche).
 * Fuera de las franjas se cobra el precio base de la cancha.
 */
final class FranjaPrecio extends Modelo
{
    protected string $tabla = 'franjas_precio';

    public function listarPorCancha(int $canchaId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM franjas_precio WHERE cancha_id = ? ORDER BY hora_desde');
        $stmt->execute([$canchaId]);
        return $stmt->fetchAll();
    }

    // Busca la franja junto con el id del dueño de su cancha
    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT f.*, x.usuario_id FROM franjas_precio f
             JOIN canchas c ON c.id = f.cancha_id
             JOIN complejos x ON x.id = c.complejo_id
             WHERE f.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    // Dos rangos se pisan si cada uno empieza antes de que termine el otro
    public function seSuperpone(int $canchaId, string $desde, string $hasta): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT 1 FROM franjas_precio WHERE cancha_id = ? AND hora_desde < ? AND hora_hasta > ?'
        );
        $stmt->execute([$canchaId, $hasta, $desde]);
        return (bool) $stmt->fetchColumn();
    }

    // Precio de la franja que contiene esa hora de inicio; null si no hay ninguna
    public function precioEn(int $canchaId, string $hora): ?float
    {
        $stmt = $this->pdo->prepare(
            'SELECT precio FROM franjas_precio WHERE cancha_id = ? AND hora_desde <= ? AND hora_hasta > ? LIMIT 1'
        );
        $stmt->execute([$canchaId, $hora, $hora]);
        $precio = $stmt->fetchColumn();
        return $precio !== false ? (float) $precio : null;
    }

    public function crear(int $canchaId, string $desde, string $hasta, float $precio): int
    {
        return $this->insertar([
            'cancha_id' => $canchaId,
            'hora_desde' => $desde,
            'hora_hasta' => $hasta,
            'precio' => $precio,
        ]);
    }

    public function borrar(int $id): void
    {
        $this->pdo->prepare('DELETE FROM franjas_precio WHERE id = ?')->execute([$id]);
    }

    public function publico(array $franja): array
    {
        return [
            'id' => (int) $franja['id'],
            'horaDesde' => substr($franja['hora_desde'], 0, 5),
            'horaHasta' => substr($franja['hora_hasta'], 0, 5),
            'precio' => (float) $franja['precio'],
        ];
    }
}
