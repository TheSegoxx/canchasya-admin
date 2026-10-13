<?php

declare(strict_types=1);

namespace App\Services;

use App\ErrorHttp;
use App\Models\LinkPago;
use App\Models\Turno;
use PDO;
use Throwable;

/**
 * Links de Mercado Pago de los turnos: verificar si los pagaron (desde la app o desde
 * la tarea automática bin/avisos.php) y vencerlos cuando se cancela el turno.
 */
final class LinksDePago
{
    private LinkPago $links;

    public function __construct(private PDO $pdo)
    {
        $this->links = new LinkPago($pdo);
    }

    /**
     * Si Mercado Pago aprobó el pago del link, lo registra en la cuenta del turno (una sola vez).
     * Si no y ya venció, lo marca vencido. Va dentro de una transacción.
     *
     * @return array{pagado: bool, aviso: ?string}
     */
    public function verificar(int $id, MercadoPago $mercadoPago): array
    {
        $link = $this->links->trabar($id);
        if ($link['estado'] !== 'pendiente') {
            return ['pagado' => false, 'aviso' => null];
        }
        $pago = $mercadoPago->pagoAprobado(LinkPago::referencia($id));
        if ($pago !== null) {
            if (abs($pago['monto'] - (float) $link['monto']) > 0.01) {
                throw new ErrorHttp(409, 'El pago aprobado en Mercado Pago no coincide con el monto del link. Revisalo en Mercado Pago.');
            }
            [$pagoId, $aviso] = (new CobroService($this->pdo))->registrarPagoMercadoPago((int) $link['turno_id'], $pago['monto']);
            $this->links->marcarPagado($id, $pago['id'], $pagoId);
            return ['pagado' => true, 'aviso' => $aviso];
        }
        if ($link['vence_en'] < date('Y-m-d H:i:s')) {
            $this->links->cambiarEstado($id, 'vencido');
        }
        return ['pagado' => false, 'aviso' => null];
    }

    // Notificación "Pago recibido": después de la transacción de verificar()
    public function avisarPago(int $id, ?int $exceptoUsuarioId = null): void
    {
        $link = $this->links->buscarPorId($id);
        $turno = (new Turno($this->pdo))->buscarDetalle((int) $link['turno_id']);
        (new Notificaciones($this->pdo))->alComplejo(
            (int) $turno['complejo_id'],
            'Pago recibido por Mercado Pago',
            sprintf(
                '%s pagó %s · %s, %s',
                $turno['cliente_nombre'],
                pesos((float) $link['monto']),
                $turno['cancha_nombre'],
                Notificaciones::cuando($turno['fecha'], $turno['hora_inicio'])
            ),
            ['turnoId' => (int) $turno['id']],
            $exceptoUsuarioId
        );
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
            foreach ($pendientes as $link) {
                $mercadoPago->vencerLink($link['preferencia_id']);
                $this->links->cambiarEstado((int) $link['id'], 'anulado');
            }
        } catch (Throwable $e) {
            error_log('[CanchasYa API] No se pudieron anular links de Mercado Pago: ' . $e->getMessage());
        }
    }
}
