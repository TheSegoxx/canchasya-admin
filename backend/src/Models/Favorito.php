<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Complejos que un jugador guardó como favoritos.
 */
final class Favorito extends Modelo
{
    protected string $tabla = 'favoritos';

    public function agregar(int $usuarioId, int $complejoId): void
    {
        $this->pdo->prepare('INSERT IGNORE INTO favoritos (usuario_id, complejo_id) VALUES (?, ?)')
            ->execute([$usuarioId, $complejoId]);
    }

    public function quitar(int $usuarioId, int $complejoId): void
    {
        $this->pdo->prepare('DELETE FROM favoritos WHERE usuario_id = ? AND complejo_id = ?')
            ->execute([$usuarioId, $complejoId]);
    }

    /** @return list<int> */
    public function idsDe(int $usuarioId): array
    {
        $stmt = $this->pdo->prepare('SELECT complejo_id FROM favoritos WHERE usuario_id = ?');
        $stmt->execute([$usuarioId]);
        return array_map('intval', $stmt->fetchAll(\PDO::FETCH_COLUMN));
    }
}
