<?php

declare(strict_types=1);

namespace App\Models;

/**
 * "Me falta uno": el jugador que reservó busca gente para completar el partido y otros
 * jugadores se suman. Al sumarse, cada uno ve el celular del organizador y el organizador
 * ve el de los que se sumaron (para coordinar por WhatsApp).
 */
final class PartidoAbierto extends Modelo
{
    protected string $tabla = 'partidos_abiertos';

    public const NIVELES = ['cualquiera', 'principiante', 'intermedio', 'avanzado'];

    // Los partidos que se pueden ver: el turno sigue confirmado, no empezó y el complejo está en CanchasYa
    private const VISIBLES =
        "SELECT p.*, t.fecha, t.hora_inicio, t.hora_fin, t.usuario_id AS organizador_id,
                c.nombre AS cancha_nombre, c.deporte, x.id AS complejo_id, x.nombre AS complejo_nombre,
                x.direccion AS complejo_direccion, x.ciudad AS complejo_ciudad,
                x.latitud AS complejo_latitud, x.longitud AS complejo_longitud,
                u.nombre AS organizador_nombre, u.telefono AS organizador_telefono,
                (SELECT COUNT(*) FROM partido_jugadores j WHERE j.partido_id = p.id) AS sumados,
                EXISTS (SELECT 1 FROM partido_jugadores j WHERE j.partido_id = p.id AND j.usuario_id = :yo) AS sumado
         FROM partidos_abiertos p
         JOIN turnos t ON t.id = p.turno_id
         JOIN canchas c ON c.id = t.cancha_id
         JOIN complejos x ON x.id = c.complejo_id
         JOIN usuarios u ON u.id = t.usuario_id
         WHERE t.estado = 'confirmado' AND TIMESTAMP(t.fecha, t.hora_inicio) > :ahora AND x.visible = 1";

    /**
     * Los que buscan jugadores (sin los del propio jugador). También los completos o cerrados
     * a los que ya se sumó, para que los vea.
     */
    public function listarAbiertos(int $usuarioId, ?string $deporte): array
    {
        $sql = self::VISIBLES . ' AND t.usuario_id <> :yo2' . ($deporte !== null ? ' AND c.deporte = :deporte' : '')
            . ' HAVING sumado = 1 OR (p.cerrado = 0 AND sumados < p.faltan)
              ORDER BY t.fecha, t.hora_inicio LIMIT 50';
        $stmt = $this->pdo->prepare($sql);
        $valores = ['yo' => $usuarioId, 'yo2' => $usuarioId, 'ahora' => date('Y-m-d H:i:s')];
        if ($deporte !== null) {
            $valores['deporte'] = $deporte;
        }
        $stmt->execute($valores);
        return $stmt->fetchAll();
    }

    // Un partido visible, o null (ya empezó, se canceló el turno...)
    public function buscarVisible(int $id, int $usuarioId): ?array
    {
        $stmt = $this->pdo->prepare(self::VISIBLES . ' AND p.id = :id');
        $stmt->execute(['yo' => $usuarioId, 'ahora' => date('Y-m-d H:i:s'), 'id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function buscarPorTurno(int $turnoId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM partidos_abiertos WHERE turno_id = ?');
        $stmt->execute([$turnoId]);
        return $stmt->fetch() ?: null;
    }

    // Lo publica o lo actualiza (y lo vuelve a abrir si estaba cerrado)
    public function publicar(int $turnoId, int $faltan, string $nivel, ?string $comentario): void
    {
        $this->pdo->prepare(
            'INSERT INTO partidos_abiertos (turno_id, faltan, nivel, comentario) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE faltan = VALUES(faltan), nivel = VALUES(nivel), comentario = VALUES(comentario), cerrado = 0'
        )->execute([$turnoId, $faltan, $nivel, $comentario]);
    }

    public function cerrar(int $turnoId): void
    {
        $this->pdo->prepare('UPDATE partidos_abiertos SET cerrado = 1 WHERE turno_id = ?')->execute([$turnoId]);
    }

    // Trabado hasta el fin de la transacción: dos que se suman a la vez no pasan el cupo
    public function trabar(int $id): void
    {
        $this->pdo->prepare('SELECT id FROM partidos_abiertos WHERE id = ? FOR UPDATE')->execute([$id]);
    }

    /** @return list<array{nombre: string, telefono: ?string}> */
    public function jugadores(int $partidoId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT u.id, u.nombre, u.telefono FROM partido_jugadores j JOIN usuarios u ON u.id = j.usuario_id
             WHERE j.partido_id = ? ORDER BY j.creado_en'
        );
        $stmt->execute([$partidoId]);
        return $stmt->fetchAll();
    }

    public function sumar(int $partidoId, int $usuarioId): bool
    {
        $stmt = $this->pdo->prepare('INSERT IGNORE INTO partido_jugadores (partido_id, usuario_id) VALUES (?, ?)');
        $stmt->execute([$partidoId, $usuarioId]);
        return $stmt->rowCount() === 1;
    }

    public function bajar(int $partidoId, int $usuarioId): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM partido_jugadores WHERE partido_id = ? AND usuario_id = ?');
        $stmt->execute([$partidoId, $usuarioId]);
        return $stmt->rowCount() === 1;
    }

    // Como lo ve otro jugador: el celular del organizador, solo si ya se sumó
    public function publico(array $p): array
    {
        $sumado = (bool) $p['sumado'];
        return [
            'id' => (int) $p['id'],
            'deporte' => $p['deporte'],
            'fecha' => $p['fecha'],
            'horaInicio' => horaCorta($p['hora_inicio']),
            'horaFin' => horaCorta($p['hora_fin']),
            'buscan' => (int) $p['faltan'],
            'faltan' => max(0, (int) $p['faltan'] - (int) $p['sumados']),
            'nivel' => $p['nivel'],
            'comentario' => $p['comentario'],
            'cerrado' => (bool) $p['cerrado'],
            'cancha' => $p['cancha_nombre'],
            'complejo' => [
                'id' => (int) $p['complejo_id'],
                'nombre' => $p['complejo_nombre'],
                'direccion' => $p['complejo_direccion'],
                'ciudad' => $p['complejo_ciudad'],
                'ubicacion' => Complejo::ubicacion($p, 'complejo_'),
            ],
            'organizador' => strtok($p['organizador_nombre'], ' '),
            'sumado' => $sumado,
            'telefonoOrganizador' => $sumado ? $p['organizador_telefono'] : null,
        ];
    }
}
