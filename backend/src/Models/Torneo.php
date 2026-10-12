<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Torneo o liga del complejo. Pasa de inscripción (se cargan equipos) a en curso
 * (al sortear el fixture) y a finalizado (cuando hay campeón).
 */
final class Torneo extends Modelo
{
    protected string $tabla = 'torneos';

    public const FORMATOS = ['liga', 'eliminacion'];

    // Con la cantidad de equipos, del más nuevo al más viejo
    public function listarPorComplejo(int $complejoId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT t.*, (SELECT COUNT(*) FROM torneo_equipos e WHERE e.torneo_id = t.id) AS equipos
             FROM torneos t WHERE t.complejo_id = ? ORDER BY t.id DESC'
        );
        $stmt->execute([$complejoId]);
        return $stmt->fetchAll();
    }

    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT t.*, x.usuario_id FROM torneos t JOIN complejos x ON x.id = t.complejo_id WHERE t.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    // Traba el torneo hasta el fin de la transacción: los cambios al fixture van de a uno
    public function trabar(int $id): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM torneos WHERE id = ? FOR UPDATE');
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public function crear(int $complejoId, string $nombre, string $deporte, string $formato): int
    {
        return $this->insertar(['complejo_id' => $complejoId, 'nombre' => $nombre, 'deporte' => $deporte, 'formato' => $formato]);
    }

    public function cambiarEstado(int $id, string $estado): void
    {
        $this->actualizar($id, ['estado' => $estado]);
    }

    public function borrar(int $id): void
    {
        $this->pdo->prepare('DELETE FROM torneos WHERE id = ?')->execute([$id]);
    }

    public function publico(array $torneo): array
    {
        return [
            'id' => (int) $torneo['id'],
            'nombre' => $torneo['nombre'],
            'deporte' => $torneo['deporte'],
            'formato' => $torneo['formato'],
            'estado' => $torneo['estado'],
            'equipos' => isset($torneo['equipos']) ? (int) $torneo['equipos'] : null,
        ];
    }
}
