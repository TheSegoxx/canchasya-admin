<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use App\Models\Complejo;
use PDO;
use Throwable;

/**
 * Base de los controladores: conexión a la base y usuario logueado.
 * responder() y leerJson() son funciones globales (src/helpers.php).
 */
abstract class Controlador
{
    protected PDO $pdo;
    private ?int $usuarioId = null;

    public function __construct()
    {
        $this->pdo = Database::conexion();
    }

    // Id del dueño identificado por el token; responde 401 si no hay sesión válida.
    // El token se verifica una sola vez por petición.
    protected function usuarioActual(): int
    {
        return $this->usuarioId ??= autenticar();
    }

    protected function complejoDelDueno(): array
    {
        $complejo = (new Complejo($this->pdo))->buscarPorUsuario($this->usuarioActual());
        if ($complejo === null) {
            responder(409, ['error' => 'Primero configurá los datos de tu complejo']);
        }
        return $complejo;
    }

    // 404 si no existe; 403 si es de otro dueño
    protected function verificarDueno(?array $fila, string $que): array
    {
        if ($fila === null) {
            responder(404, ['error' => "$que no existe"]);
        }
        if ((int) $fila['usuario_id'] !== $this->usuarioActual()) {
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
