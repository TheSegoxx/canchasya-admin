<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Complejo deportivo. Cada dueño tiene uno solo (UNIQUE usuario_id).
 */
final class Complejo extends Modelo
{
    protected string $tabla = 'complejos';

    // Servicios que se pueden marcar en la app
    public const SERVICIOS = ['vestuarios', 'duchas', 'buffet', 'estacionamiento', 'wifi', 'parrilla'];

    public function buscarPorUsuario(int $usuarioId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM complejos WHERE usuario_id = ?');
        $stmt->execute([$usuarioId]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Crea el complejo del dueño o actualiza el que ya tiene.
     * Devuelve true si lo creó.
     */
    public function guardar(int $usuarioId, array $datos): bool
    {
        $columnas = [
            'nombre' => $datos['nombre'],
            'direccion' => $datos['direccion'],
            'telefono' => $datos['telefono'],
            'hora_apertura' => $datos['horaApertura'],
            'hora_cierre' => $datos['horaCierre'],
            'servicios' => json_encode($datos['servicios']),
        ];

        $existente = $this->buscarPorUsuario($usuarioId);
        if ($existente === null) {
            $this->insertar(['usuario_id' => $usuarioId, ...$columnas]);
            return true;
        }
        $this->actualizar((int) $existente['id'], $columnas);
        return false;
    }

    // Formato que recibe la app (horas como "HH:MM")
    public function publico(array $complejo): array
    {
        return [
            'id' => (int) $complejo['id'],
            'nombre' => $complejo['nombre'],
            'direccion' => $complejo['direccion'],
            'telefono' => $complejo['telefono'],
            'horaApertura' => substr($complejo['hora_apertura'], 0, 5),
            'horaCierre' => substr($complejo['hora_cierre'], 0, 5),
            'servicios' => json_decode($complejo['servicios'] ?? '[]', true) ?? [],
        ];
    }
}
