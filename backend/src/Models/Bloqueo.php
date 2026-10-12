<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Cancha cerrada en un rango de fecha y hora (lluvia, mantenimiento, evento).
 * "desde" y "hasta" son DATETIME; un bloqueo hasta la medianoche termina
 * a las 00:00 del día siguiente.
 */
final class Bloqueo extends Modelo
{
    protected string $tabla = 'bloqueos';

    public const MOTIVO_MAXIMO = 100;

    // Los que tocan algún momento de ese día
    public function listarPorFecha(int $complejoId, string $fecha): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT b.* FROM bloqueos b JOIN canchas c ON c.id = b.cancha_id
             WHERE c.complejo_id = ? AND b.desde < ? AND b.hasta > ?
             ORDER BY b.desde'
        );
        $stmt->execute([$complejoId, sumarDias($fecha, 1) . ' 00:00:00', "$fecha 00:00:00"]);
        return $stmt->fetchAll();
    }

    public function superpuesto(int $canchaId, string $desde, string $hasta): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM bloqueos WHERE cancha_id = ? AND desde < ? AND hasta > ? ORDER BY desde LIMIT 1'
        );
        $stmt->execute([$canchaId, $hasta, $desde]);
        return $stmt->fetch() ?: null;
    }

    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT b.*, x.usuario_id FROM bloqueos b
             JOIN canchas c ON c.id = b.cancha_id
             JOIN complejos x ON x.id = c.complejo_id
             WHERE b.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function crear(int $canchaId, string $desde, string $hasta, string $motivo): int
    {
        return $this->insertar(['cancha_id' => $canchaId, 'desde' => $desde, 'hasta' => $hasta, 'motivo' => $motivo]);
    }

    // Nombre del torneo si el bloqueo reserva la cancha para uno de sus partidos; null si no
    public function torneoQueLoUsa(int $id): ?string
    {
        $stmt = $this->pdo->prepare(
            'SELECT t.nombre FROM partidos p JOIN torneos t ON t.id = p.torneo_id WHERE p.bloqueo_id = ?'
        );
        $stmt->execute([$id]);
        $nombre = $stmt->fetchColumn();
        return $nombre !== false ? $nombre : null;
    }

    public function borrar(int $id): void
    {
        $this->pdo->prepare('DELETE FROM bloqueos WHERE id = ?')->execute([$id]);
    }

    /**
     * Visto desde un día de la agenda: las horas se recortan a ese día
     * ("00:00" si empezó antes, "24:00" si sigue después).
     */
    public function publico(array $bloqueo, string $fecha): array
    {
        $inicioDia = "$fecha 00:00:00";
        $finDia = sumarDias($fecha, 1) . ' 00:00:00';
        $desde = max($bloqueo['desde'], $inicioDia);
        $hasta = min($bloqueo['hasta'], $finDia);

        return [
            'id' => (int) $bloqueo['id'],
            'canchaId' => (int) $bloqueo['cancha_id'],
            'horaDesde' => substr($desde, 11, 5),
            'horaHasta' => $hasta === $finDia ? '24:00' : substr($hasta, 11, 5),
            'motivo' => $bloqueo['motivo'],
        ];
    }
}
