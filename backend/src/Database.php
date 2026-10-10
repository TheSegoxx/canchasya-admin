<?php

declare(strict_types=1);

namespace App;

use PDO;

/**
 * Conexión única a MariaDB/MySQL mediante PDO.
 */
final class Database
{
    private static ?PDO $pdo = null;

    public static function conexion(): PDO
    {
        if (self::$pdo === null) {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                $_ENV['DB_HOST'],
                $_ENV['DB_PORT'] ?? '3306',
                $_ENV['DB_NAME']
            );
            self::$pdo = new PDO($dsn, $_ENV['DB_USER'], $_ENV['DB_PASS'] ?? '', [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                // Consultas preparadas reales del motor: protegen contra inyección SQL
                PDO::ATTR_EMULATE_PREPARES => false,
                // Misma zona horaria que PHP (Argentina, UTC-3)
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '-03:00'",
            ]);
        }
        return self::$pdo;
    }
}
