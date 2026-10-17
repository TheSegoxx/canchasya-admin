<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Cuenta de la app: un jugador (el cliente que reserva canchas), el dueño de un complejo
 * o un empleado (encargado) del complejo de otro.
 */
final class Usuario extends Modelo
{
    protected string $tabla = 'usuarios';

    // Los que se eligen al crear la cuenta (el encargado entra después con un código del dueño)
    public const ROLES_ELEGIBLES = ['jugador', 'dueno'];
    public const DEPORTES = ['padel', 'futbol5'];

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

    /**
     * @param array{rol?: string, rolElegido?: bool, telefono?: ?string, ciudad?: ?string, deportes?: list<string>} $perfil
     *        Sin rol: dueño (como la app 1.0)
     */
    public function crear(
        string $nombre,
        string $email,
        ?string $passwordHash,
        ?string $googleId = null,
        ?string $fotoUrl = null,
        array $perfil = []
    ): int {
        return $this->insertar([
            'nombre' => $nombre,
            'email' => $email,
            'password_hash' => $passwordHash,
            'google_id' => $googleId,
            'foto_url' => $fotoUrl,
            'rol' => $perfil['rol'] ?? 'dueno',
            'rol_elegido' => ($perfil['rolElegido'] ?? true) ? 1 : 0,
            'telefono' => $perfil['telefono'] ?? null,
            'ciudad' => $perfil['ciudad'] ?? null,
            'deportes' => isset($perfil['deportes']) ? json_encode($perfil['deportes']) : null,
        ]);
    }

    /** @param array{nombre: string, telefono: string, ciudad: ?string, deportes: ?list<string>, rol?: string} $perfil */
    public function guardarPerfil(int $id, array $perfil): void
    {
        $columnas = [
            'nombre' => $perfil['nombre'],
            'telefono' => $perfil['telefono'],
            'ciudad' => $perfil['ciudad'],
            'deportes' => $perfil['deportes'] !== null ? json_encode($perfil['deportes']) : null,
        ];
        if (isset($perfil['rol'])) {
            $columnas['rol'] = $perfil['rol'];
            $columnas['rol_elegido'] = 1;
        }
        $this->actualizar($id, $columnas);
    }

    // Asocia una cuenta creada con email a su cuenta de Google
    public function vincularGoogle(int $id, string $googleId, ?string $fotoUrl): void
    {
        $this->actualizar($id, ['google_id' => $googleId, 'foto_url' => $fotoUrl]);
    }

    public function cambiarPassword(int $id, string $passwordHash): void
    {
        $this->actualizar($id, ['password_hash' => $passwordHash]);
    }

    public function verificarPassword(array $usuario, string $password): bool
    {
        return $usuario['password_hash'] !== null && password_verify($password, $usuario['password_hash']);
    }

    // Nombre del complejo propio (dueño) o donde trabaja (empleado); null si no tiene (o es jugador)
    public function nombreDelComplejo(array $usuario): ?string
    {
        if ($usuario['rol'] === 'jugador') {
            return null;
        }
        $stmt = $usuario['rol'] === 'empleado'
            ? $this->pdo->prepare('SELECT nombre FROM complejos WHERE id = ?')
            : $this->pdo->prepare('SELECT nombre FROM complejos WHERE usuario_id = ?');
        $stmt->execute([$usuario['rol'] === 'empleado' ? $usuario['complejo_id'] : $usuario['id']]);
        $nombre = $stmt->fetchColumn();
        return $nombre !== false ? $nombre : null;
    }

    public function listarEmpleados(int $complejoId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM usuarios WHERE rol = 'empleado' AND complejo_id = ? ORDER BY nombre"
        );
        $stmt->execute([$complejoId]);
        return $stmt->fetchAll();
    }

    public function hacerEmpleado(int $id, int $complejoId): void
    {
        $this->actualizar($id, ['rol' => 'empleado', 'complejo_id' => $complejoId]);
    }

    // Vuelve a ser una cuenta común, sin complejo (puede crear el suyo o unirse a otro)
    public function quitarDelComplejo(int $id): void
    {
        $this->actualizar($id, ['rol' => 'dueno', 'complejo_id' => null]);
    }

    // Datos que se pueden mostrar en la app (nunca el hash de la contraseña)
    public function publico(array $usuario): array
    {
        $complejo = $this->nombreDelComplejo($usuario);
        return [
            'id' => (int) $usuario['id'],
            'nombre' => $usuario['nombre'],
            'email' => $usuario['email'],
            'foto' => $usuario['foto_url'],
            'tienePassword' => $usuario['password_hash'] !== null,
            'telefono' => $usuario['telefono'],
            'ciudad' => $usuario['ciudad'],
            'deportes' => json_decode($usuario['deportes'] ?? '[]', true) ?? [],
            'rol' => $usuario['rol'],
            // false: entró con Google y la app tiene que preguntarle si es jugador o dueño
            'rolElegido' => (bool) $usuario['rol_elegido'],
            'tieneComplejo' => $complejo !== null,
            'complejo' => $complejo,
        ];
    }
}
