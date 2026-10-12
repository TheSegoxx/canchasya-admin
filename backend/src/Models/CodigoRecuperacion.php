<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Código de 6 números que se manda por email para cambiar la contraseña (se guarda solo su hash).
 * Las fechas se calculan con NOW() de la base, así crear y comparar usan el mismo reloj.
 */
final class CodigoRecuperacion extends Modelo
{
    protected string $tabla = 'codigos_recuperacion';

    // Segundos desde el último código que pidió el usuario; null si nunca pidió
    public function segundosDesdeElUltimo(int $usuarioId): ?int
    {
        $stmt = $this->pdo->prepare(
            'SELECT TIMESTAMPDIFF(SECOND, MAX(creado_en), NOW()) FROM codigos_recuperacion WHERE usuario_id = ?'
        );
        $stmt->execute([$usuarioId]);
        $segundos = $stmt->fetchColumn();
        return $segundos === null ? null : (int) $segundos;
    }

    // Guarda un código nuevo y deja sin efecto los anteriores
    public function crear(int $usuarioId, string $codigoHash, int $minutosDeValidez): void
    {
        $this->pdo->prepare('UPDATE codigos_recuperacion SET usado = 1 WHERE usuario_id = ? AND usado = 0')
            ->execute([$usuarioId]);
        $this->pdo->prepare(
            'INSERT INTO codigos_recuperacion (usuario_id, codigo_hash, vence_en) VALUES (?, ?, NOW() + INTERVAL ? MINUTE)'
        )->execute([$usuarioId, $codigoHash, $minutosDeValidez]);
    }

    // El código vigente del usuario, bloqueado hasta el fin de la transacción
    // (dos intentos al mismo tiempo no pueden usarlo dos veces ni saltear el límite)
    public function vigenteParaActualizar(int $usuarioId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM codigos_recuperacion
             WHERE usuario_id = ? AND usado = 0 AND vence_en > NOW()
             ORDER BY id DESC LIMIT 1 FOR UPDATE'
        );
        $stmt->execute([$usuarioId]);
        return $stmt->fetch() ?: null;
    }

    public function sumarIntento(int $id): void
    {
        $this->pdo->prepare('UPDATE codigos_recuperacion SET intentos = intentos + 1 WHERE id = ?')->execute([$id]);
    }

    public function marcarUsado(int $id): void
    {
        $this->actualizar($id, ['usado' => 1]);
    }
}
