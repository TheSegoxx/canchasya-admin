<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Celular donde un usuario recibe notificaciones (token de Firebase Cloud Messaging).
 */
final class Dispositivo extends Modelo
{
    protected string $tabla = 'dispositivos';

    // Si el celular ya estaba registrado (otra cuenta usó la app en ese celular), pasa al usuario actual
    public function registrar(int $usuarioId, string $token): void
    {
        $this->pdo->prepare(
            'INSERT INTO dispositivos (usuario_id, token) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), actualizado_en = CURRENT_TIMESTAMP'
        )->execute([$usuarioId, $token]);
    }

    public function quitar(int $usuarioId, string $token): void
    {
        $this->pdo->prepare('DELETE FROM dispositivos WHERE usuario_id = ? AND token = ?')->execute([$usuarioId, $token]);
    }

    /** @param list<string> $tokens */
    public function borrarTokens(array $tokens): void
    {
        if ($tokens === []) {
            return;
        }
        $marcas = implode(', ', array_fill(0, count($tokens), '?'));
        $this->pdo->prepare("DELETE FROM dispositivos WHERE token IN ($marcas)")->execute($tokens);
    }

    /** @return list<string> */
    public function tokensDelUsuario(int $usuarioId): array
    {
        $stmt = $this->pdo->prepare('SELECT token FROM dispositivos WHERE usuario_id = ?');
        $stmt->execute([$usuarioId]);
        return $stmt->fetchAll(\PDO::FETCH_COLUMN);
    }

    /**
     * Tokens de la gente del complejo: el dueño y, si $conEncargados, sus empleados.
     *
     * @return list<string>
     */
    public function tokensDelComplejo(int $complejoId, bool $conEncargados, ?int $exceptoUsuarioId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT d.token FROM dispositivos d
             JOIN usuarios u ON u.id = d.usuario_id
             WHERE (u.id = (SELECT usuario_id FROM complejos WHERE id = :complejo)
                    OR (:encargados = 1 AND u.rol = 'empleado' AND u.complejo_id = :complejo2))
               AND u.id <> :excepto"
        );
        $stmt->execute([
            'complejo' => $complejoId,
            'complejo2' => $complejoId,
            'encargados' => $conEncargados ? 1 : 0,
            'excepto' => $exceptoUsuarioId ?? 0,
        ]);
        return $stmt->fetchAll(\PDO::FETCH_COLUMN);
    }
}
