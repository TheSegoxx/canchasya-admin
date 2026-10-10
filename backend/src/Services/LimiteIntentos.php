<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

/**
 * Limita los intentos fallidos de login y los registros por IP
 * (por defecto 5 por minuto) para frenar ataques de fuerza bruta.
 */
final class LimiteIntentos
{
    public function __construct(
        private PDO $pdo,
        private int $maximo = 5,
        private int $ventanaSegundos = 60
    ) {
    }

    // Responde 429 si la IP ya acumuló el máximo de intentos en la ventana de tiempo
    public function verificar(string $ip): void
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM intentos_login WHERE ip = ? AND momento > NOW() - INTERVAL ? SECOND'
        );
        $stmt->execute([$ip, $this->ventanaSegundos]);

        if ((int) $stmt->fetchColumn() >= $this->maximo) {
            responder(429, ['error' => 'Demasiados intentos. Esperá un minuto y probá de nuevo.']);
        }
    }

    // Suma un intento a la cuenta de esta IP
    public function registrar(string $ip): void
    {
        $this->pdo->prepare('INSERT INTO intentos_login (ip) VALUES (?)')->execute([$ip]);

        // Limpieza: los intentos de más de un día ya no sirven
        $this->pdo->exec('DELETE FROM intentos_login WHERE momento < NOW() - INTERVAL 1 DAY');
    }
}
