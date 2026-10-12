<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Equipo (fútbol 5) o pareja (pádel) inscripto en un torneo.
 */
final class EquipoTorneo extends Modelo
{
    protected string $tabla = 'torneo_equipos';

    public function listarPorTorneo(int $torneoId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM torneo_equipos WHERE torneo_id = ? ORDER BY id');
        $stmt->execute([$torneoId]);
        return $stmt->fetchAll();
    }

    // Con el estado del torneo y el dueño de su complejo
    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT e.*, t.estado AS torneo_estado, x.usuario_id FROM torneo_equipos e
             JOIN torneos t ON t.id = e.torneo_id
             JOIN complejos x ON x.id = t.complejo_id
             WHERE e.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function nombreEnUso(int $torneoId, string $nombre): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM torneo_equipos WHERE torneo_id = ? AND nombre = ?');
        $stmt->execute([$torneoId, $nombre]);
        return (bool) $stmt->fetchColumn();
    }

    public function crear(int $torneoId, string $nombre, ?string $integrantes, ?string $telefono): int
    {
        return $this->insertar([
            'torneo_id' => $torneoId,
            'nombre' => $nombre,
            'integrantes' => $integrantes,
            'telefono' => $telefono,
        ]);
    }

    public function borrar(int $id): void
    {
        $this->pdo->prepare('DELETE FROM torneo_equipos WHERE id = ?')->execute([$id]);
    }

    public function publico(array $equipo): array
    {
        return [
            'id' => (int) $equipo['id'],
            'nombre' => $equipo['nombre'],
            'integrantes' => $equipo['integrantes'],
            'telefono' => $equipo['telefono'],
        ];
    }
}
