<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

/**
 * Programa de fidelidad del complejo: cada tantos turnos jugados desde la app, un premio
 * (un turno gratis o con descuento). Un sello es un turno reservado desde la app que no se
 * canceló, ya terminó y no se pagó con un premio. Los premios que se usan en reservas activas
 * se descuentan; si la reserva se cancela, el premio vuelve.
 */
final class Fidelidad
{
    public function __construct(private PDO $pdo)
    {
    }

    /**
     * Cómo va el jugador en ese complejo, o null si el complejo no tiene programa.
     *
     * @return array{turnos: int, descuento: int, sellos: int, premios: int}|null
     */
    public function de(int $usuarioId, array $complejo): ?array
    {
        $cada = (int) $complejo['fidelidad_turnos'];
        if ($cada === 0) {
            return null;
        }
        $stmt = $this->pdo->prepare(
            "SELECT COALESCE(SUM(t.premio = 0 AND TIMESTAMP(t.fecha, t.hora_fin) <= ?), 0) AS jugados,
                    COALESCE(SUM(t.premio = 1), 0) AS usados
             FROM turnos t JOIN canchas c ON c.id = t.cancha_id
             WHERE t.usuario_id = ? AND c.complejo_id = ? AND t.estado <> 'cancelado'"
        );
        $stmt->execute([date('Y-m-d H:i:s'), $usuarioId, (int) $complejo['id']]);
        $fila = $stmt->fetch();
        $jugados = (int) $fila['jugados'];
        return [
            'turnos' => $cada,
            'descuento' => (int) $complejo['fidelidad_descuento'],
            // Los sellos de la tarjeta que está llenando
            'sellos' => $jugados % $cada,
            'premios' => max(0, intdiv($jugados, $cada) - (int) $fila['usados']),
        ];
    }

    /**
     * Las tarjetas del jugador: los complejos con programa donde ya reservó desde la app.
     *
     * @return list<array>
     */
    public function tarjetas(int $usuarioId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT DISTINCT x.* FROM complejos x
             JOIN canchas c ON c.complejo_id = x.id
             JOIN turnos t ON t.cancha_id = c.id
             WHERE t.usuario_id = ? AND x.fidelidad_turnos > 0 AND x.visible = 1
             ORDER BY x.nombre'
        );
        $stmt->execute([$usuarioId]);
        return array_map(
            fn (array $x) => ['complejoId' => (int) $x['id'], 'complejo' => $x['nombre'], ...$this->de($usuarioId, $x)],
            $stmt->fetchAll()
        );
    }
}
