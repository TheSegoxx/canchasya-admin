<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\LinkPago;
use PDO;
use Throwable;

/**
 * Cuando se cancela un turno, sus links de Mercado Pago sin pagar se vencen
 * para que el cliente no pague un turno que ya no existe.
 */
final class LinksDePago
{
    public function __construct(private PDO $pdo)
    {
    }

    /**
     * Va fuera de las transacciones (llama a Mercado Pago). Si Mercado Pago no responde
     * o no está configurado, el link queda pendiente: si igual lo pagan, al verificar se
     * registra el pago con un aviso para devolverlo.
     *
     * @param list<int> $turnoIds
     */
    public function anularDeTurnosCancelados(array $turnoIds): void
    {
        if ($turnoIds === []) {
            return;
        }
        $marcas = implode(', ', array_fill(0, count($turnoIds), '?'));
        $stmt = $this->pdo->prepare(
            "SELECT l.id, l.preferencia_id FROM links_pago l JOIN turnos t ON t.id = l.turno_id
             WHERE l.turno_id IN ($marcas) AND l.estado = 'pendiente' AND t.estado = 'cancelado'"
        );
        $stmt->execute(array_values($turnoIds));
        $pendientes = $stmt->fetchAll();
        if ($pendientes === []) {
            return;
        }

        try {
            $mercadoPago = new MercadoPago();
            $links = new LinkPago($this->pdo);
            foreach ($pendientes as $link) {
                $mercadoPago->vencerLink($link['preferencia_id']);
                $links->cambiarEstado((int) $link['id'], 'anulado');
            }
        } catch (Throwable $e) {
            error_log('[CanchasYa API] No se pudieron anular links de Mercado Pago: ' . $e->getMessage());
        }
    }
}
