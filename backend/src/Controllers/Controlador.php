<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use PDO;

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
}
