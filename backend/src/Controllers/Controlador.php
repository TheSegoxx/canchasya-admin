<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use App\Models\Complejo;
use PDO;
use Throwable;

/**
 * Base de los controladores: conexión a la base, usuario logueado y su complejo.
 * Un usuario es el dueño de su complejo o un empleado del complejo de otro;
 * el rol se lee de la base en cada petición, así quitarle el acceso rige al instante.
 * responder() y leerJson() son funciones globales (src/helpers.php).
 */
abstract class Controlador
{
    protected PDO $pdo;
    private ?int $usuarioId = null;
    private ?array $usuario = null;
    private ?array $complejo = null;

    public function __construct()
    {
        $this->pdo = Database::conexion();
    }

    // Id del usuario identificado por el token; responde 401 si no hay sesión válida.
    // El token se verifica una sola vez por petición.
    protected function usuarioActual(): int
    {
        return $this->usuarioId ??= autenticar();
    }

    // Fila del usuario logueado (con su rol); 401 si la cuenta ya no existe
    protected function usuario(): array
    {
        if ($this->usuario === null) {
            $stmt = $this->pdo->prepare('SELECT id, rol, complejo_id FROM usuarios WHERE id = ?');
            $stmt->execute([$this->usuarioActual()]);
            $this->usuario = $stmt->fetch() ?: responder(401, ['error' => 'La cuenta ya no existe']);
        }
        return $this->usuario;
    }

    protected function esEmpleado(): bool
    {
        return $this->usuario()['rol'] === 'empleado';
    }

    // Lo que no puede hacer un empleado: precios, dashboard, datos del complejo, borrar cobros...
    protected function soloDueno(): void
    {
        if ($this->esEmpleado()) {
            responder(403, ['error' => 'Esto solo lo puede hacer el dueño del complejo']);
        }
    }

    // El complejo propio (dueño) o en el que trabaja (empleado); 409 si todavía no tiene
    protected function complejoActual(): array
    {
        if ($this->complejo === null) {
            $complejos = new Complejo($this->pdo);
            $usuario = $this->usuario();
            $this->complejo = $usuario['rol'] === 'empleado'
                ? ($usuario['complejo_id'] !== null ? $complejos->buscarPorId((int) $usuario['complejo_id']) : null)
                : $complejos->buscarPorUsuario((int) $usuario['id']);
            if ($this->complejo === null) {
                responder(409, ['error' => 'Primero configurá los datos de tu complejo']);
            }
        }
        return $this->complejo;
    }

    /**
     * Controla que una fila (cancha, turno, cliente...) sea del complejo del usuario.
     * $fila['usuario_id'] es el dueño de su complejo. 404 si no existe; 403 si es de otro complejo.
     */
    protected function verificarDelComplejo(?array $fila, string $que): array
    {
        if ($fila === null) {
            responder(404, ['error' => "$que no existe"]);
        }
        if ((int) $fila['usuario_id'] !== (int) $this->complejoActual()['usuario_id']) {
            responder(403, ['error' => "$que no es de tu complejo"]);
        }
        return $fila;
    }

    /**
     * Ejecuta $accion en una transacción: si algo falla (incluido un ErrorHttp
     * por horario ocupado) se deshace todo lo que se hizo adentro.
     */
    protected function transaccion(callable $accion): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $resultado = $accion();
            $this->pdo->commit();
            return $resultado;
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
