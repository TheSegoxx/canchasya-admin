<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Link de Mercado Pago para pagar parte o todo un turno (normalmente la seña).
 * Cuando Mercado Pago lo aprueba, se registra como pago del turno una sola vez.
 */
final class LinkPago extends Modelo
{
    protected string $tabla = 'links_pago';

    public const HORAS_VIGENCIA = 24;

    // Con el nombre del amigo si es una parte de la vaquita
    public function listarPorTurno(int $turnoId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT l.*, v.nombre AS vaquita_nombre FROM links_pago l
             LEFT JOIN vaquita_partes v ON v.link_id = l.id
             WHERE l.turno_id = ? ORDER BY l.id DESC'
        );
        $stmt->execute([$turnoId]);
        return $stmt->fetchAll();
    }

    public function pendientesDelTurno(int $turnoId): array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM links_pago WHERE turno_id = ? AND estado = 'pendiente'");
        $stmt->execute([$turnoId]);
        return $stmt->fetchAll();
    }

    // Con el dueño del complejo, para controlar el acceso
    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT l.*, x.usuario_id FROM links_pago l
             JOIN turnos t ON t.id = l.turno_id
             JOIN canchas c ON c.id = t.cancha_id
             JOIN complejos x ON x.id = c.complejo_id
             WHERE l.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    // Trabado hasta el fin de la transacción: dos verificaciones a la vez no registran el pago dos veces
    public function trabar(int $id): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM links_pago WHERE id = ? FOR UPDATE');
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public function crear(int $turnoId, float $monto, string $preferenciaId, string $url, string $venceEn): int
    {
        return $this->insertar([
            'turno_id' => $turnoId,
            'monto' => $monto,
            'preferencia_id' => $preferenciaId,
            'url' => $url,
            'vence_en' => $venceEn,
        ]);
    }

    public function marcarPagado(int $id, string $pagoMpId, int $pagoId): void
    {
        $this->actualizar($id, ['estado' => 'pagado', 'pago_mp_id' => $pagoMpId, 'pago_id' => $pagoId]);
    }

    public function cambiarEstado(int $id, string $estado): void
    {
        $this->actualizar($id, ['estado' => $estado]);
    }

    // Lo que se manda en external_reference: así se encuentra el pago después
    public static function referencia(int $id): string
    {
        return "canchasya-link-$id";
    }

    public function publico(array $link): array
    {
        return [
            'id' => (int) $link['id'],
            'monto' => (float) $link['monto'],
            'url' => $link['url'],
            'estado' => $link['estado'],
            'venceEn' => substr($link['vence_en'], 0, 16),
            // De quién es, si es una parte de la vaquita del jugador
            'vaquita' => $link['vaquita_nombre'] ?? null,
        ];
    }
}
