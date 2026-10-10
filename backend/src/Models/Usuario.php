<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Dueño de complejo (único tipo de usuario de la app).
 */
final class Usuario extends Modelo
{
    protected string $tabla = 'usuarios';

    public function buscarPorEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM usuarios WHERE email = ?');
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }

    public function buscarPorGoogleId(string $googleId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM usuarios WHERE google_id = ?');
        $stmt->execute([$googleId]);
        return $stmt->fetch() ?: null;
    }

    public function crear(string $nombre, string $email, ?string $passwordHash, ?string $googleId = null, ?string $fotoUrl = null): int
    {
        return $this->insertar([
            'nombre' => $nombre,
            'email' => $email,
            'password_hash' => $passwordHash,
            'google_id' => $googleId,
            'foto_url' => $fotoUrl,
        ]);
    }

    // Asocia una cuenta creada con email a su cuenta de Google
    public function vincularGoogle(int $id, string $googleId, ?string $fotoUrl): void
    {
        $this->actualizar($id, ['google_id' => $googleId, 'foto_url' => $fotoUrl]);
    }

    public function verificarPassword(array $usuario, string $password): bool
    {
        return $usuario['password_hash'] !== null && password_verify($password, $usuario['password_hash']);
    }

    public function tieneComplejo(int $id): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM complejos WHERE usuario_id = ?');
        $stmt->execute([$id]);
        return (bool) $stmt->fetchColumn();
    }

    // Datos que se pueden mostrar en la app (nunca el hash de la contraseña)
    public function publico(array $usuario): array
    {
        return [
            'id' => (int) $usuario['id'],
            'nombre' => $usuario['nombre'],
            'email' => $usuario['email'],
            'foto' => $usuario['foto_url'],
            'tienePassword' => $usuario['password_hash'] !== null,
            'tieneComplejo' => $this->tieneComplejo((int) $usuario['id']),
        ];
    }
}
