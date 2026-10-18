<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Lista de espera: un jugador quiere un horario que está ocupado y se le avisa si se libera.
 */
final class Espera extends Modelo
{
    protected string $tabla = 'esperas';

    public const MAXIMO_PENDIENTES = 10;

    // Con la cancha y el complejo, para mostrarlas y para avisar
    private const CON_LUGAR =
        'SELECT e.*, c.nombre AS cancha_nombre, c.deporte AS cancha_deporte, c.complejo_id, x.nombre AS complejo_nombre
         FROM esperas e JOIN canchas c ON c.id = e.cancha_id JOIN complejos x ON x.id = c.complejo_id';

    public function crear(int $usuarioId, int $canchaId, string $fecha, string $inicio, int $duracion): int
    {
        return $this->insertar([
            'usuario_id' => $usuarioId,
            'cancha_id' => $canchaId,
            'fecha' => $fecha,
            'hora_inicio' => $inicio,
            'duracion_min' => $duracion,
        ]);
    }

    // Las del jugador que todavía no pasaron (esperando o ya avisadas)
    public function listarDelUsuario(int $usuarioId): array
    {
        $stmt = $this->pdo->prepare(
            self::CON_LUGAR . ' WHERE e.usuario_id = ? AND TIMESTAMP(e.fecha, e.hora_inicio) > ? ORDER BY e.fecha, e.hora_inicio'
        );
        $stmt->execute([$usuarioId, date('Y-m-d H:i:s')]);
        return $stmt->fetchAll();
    }

    public function contarPendientes(int $usuarioId): int
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM esperas WHERE usuario_id = ? AND avisado_en IS NULL AND TIMESTAMP(fecha, hora_inicio) > ?'
        );
        $stmt->execute([$usuarioId, date('Y-m-d H:i:s')]);
        return (int) $stmt->fetchColumn();
    }

    // Las que siguen esperando (de una cancha o de todas), de los horarios que todavía no empezaron
    public function pendientes(?int $canchaId = null): array
    {
        $sql = self::CON_LUGAR . ' WHERE e.avisado_en IS NULL AND TIMESTAMP(e.fecha, e.hora_inicio) > ?';
        $valores = [date('Y-m-d H:i:s')];
        if ($canchaId !== null) {
            $sql .= ' AND e.cancha_id = ?';
            $valores[] = $canchaId;
        }
        $stmt = $this->pdo->prepare($sql . ' ORDER BY e.creado_en');
        $stmt->execute($valores);
        return $stmt->fetchAll();
    }

    public function marcarAvisada(int $id): void
    {
        $this->actualizar($id, ['avisado_en' => date('Y-m-d H:i:s')]);
    }

    // Solo la propia; devuelve false si no era suya o no existía
    public function borrar(int $id, int $usuarioId): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM esperas WHERE id = ? AND usuario_id = ?');
        $stmt->execute([$id, $usuarioId]);
        return $stmt->rowCount() === 1;
    }

    public function publico(array $e): array
    {
        $inicio = minutosDe($e['hora_inicio']);
        return [
            'id' => (int) $e['id'],
            'complejoId' => (int) $e['complejo_id'],
            'complejo' => $e['complejo_nombre'],
            'canchaId' => (int) $e['cancha_id'],
            'cancha' => $e['cancha_nombre'],
            'deporte' => $e['cancha_deporte'],
            'fecha' => $e['fecha'],
            'horaInicio' => horaCorta($e['hora_inicio']),
            'horaFin' => horaCorta(horaDe($inicio + (int) $e['duracion_min'])),
            'duracionMin' => (int) $e['duracion_min'],
            // Ya se le avisó que se liberó (puede que otro lo haya reservado después)
            'avisada' => $e['avisado_en'] !== null,
        ];
    }
}
