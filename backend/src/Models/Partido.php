<?php

declare(strict_types=1);

namespace App\Models;

use PDO;

/**
 * Partido del fixture: dos equipos (o uno solo si el otro todavía no se conoce),
 * su resultado y, si se programó, la cancha, el día y la hora.
 */
final class Partido extends Modelo
{
    protected string $tabla = 'partidos';

    public function listarPorTorneo(int $torneoId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT p.*, c.nombre AS cancha_nombre FROM partidos p
             LEFT JOIN canchas c ON c.id = p.cancha_id
             WHERE p.torneo_id = ? ORDER BY p.ronda, p.orden'
        );
        $stmt->execute([$torneoId]);
        return $stmt->fetchAll();
    }

    // Con su torneo y el dueño del complejo
    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT p.*, t.nombre AS torneo_nombre, t.deporte, t.formato, t.estado AS torneo_estado, x.usuario_id
             FROM partidos p
             JOIN torneos t ON t.id = p.torneo_id
             JOIN complejos x ON x.id = t.complejo_id
             WHERE p.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function buscarEnPosicion(int $torneoId, int $ronda, int $orden): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM partidos WHERE torneo_id = ? AND ronda = ? AND orden = ?');
        $stmt->execute([$torneoId, $ronda, $orden]);
        return $stmt->fetch() ?: null;
    }

    public function crear(int $torneoId, int $ronda, int $orden, ?int $localId, ?int $visitanteId, ?int $ganadorId = null): int
    {
        return $this->insertar([
            'torneo_id' => $torneoId,
            'ronda' => $ronda,
            'orden' => $orden,
            'local_id' => $localId,
            'visitante_id' => $visitanteId,
            'ganador_id' => $ganadorId,
        ]);
    }

    public function guardarResultado(int $id, ?int $local, ?int $visitante, ?int $ganadorId): void
    {
        $this->actualizar($id, ['resultado_local' => $local, 'resultado_visitante' => $visitante, 'ganador_id' => $ganadorId]);
    }

    // $lado: 'local_id' o 'visitante_id'
    public function ponerEquipo(int $id, string $lado, ?int $equipoId): void
    {
        $this->actualizar($id, [$lado => $equipoId]);
    }

    public function programar(int $id, ?int $canchaId, ?string $fecha, ?string $hora, ?int $bloqueoId): void
    {
        $this->actualizar($id, ['cancha_id' => $canchaId, 'fecha' => $fecha, 'hora' => $hora, 'bloqueo_id' => $bloqueoId]);
    }

    // Antes de borrar el torneo: los partidos apuntan a los equipos y estos se borran en cascada
    public function borrarDelTorneo(int $torneoId): void
    {
        $this->pdo->prepare('DELETE FROM partidos WHERE torneo_id = ?')->execute([$torneoId]);
    }

    /** @return list<int> */
    public function bloqueosDelTorneo(int $torneoId): array
    {
        $stmt = $this->pdo->prepare('SELECT bloqueo_id FROM partidos WHERE torneo_id = ? AND bloqueo_id IS NOT NULL');
        $stmt->execute([$torneoId]);
        return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    public function publico(array $partido): array
    {
        $entero = fn ($v) => $v !== null ? (int) $v : null;
        return [
            'id' => (int) $partido['id'],
            'ronda' => (int) $partido['ronda'],
            'orden' => (int) $partido['orden'],
            'localId' => $entero($partido['local_id']),
            'visitanteId' => $entero($partido['visitante_id']),
            'resultadoLocal' => $entero($partido['resultado_local']),
            'resultadoVisitante' => $entero($partido['resultado_visitante']),
            'ganadorId' => $entero($partido['ganador_id']),
            'canchaId' => $entero($partido['cancha_id']),
            'canchaNombre' => $partido['cancha_nombre'] ?? null,
            'fecha' => $partido['fecha'],
            'hora' => $partido['hora'] !== null ? horaCorta($partido['hora']) : null,
        ];
    }
}
