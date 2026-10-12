<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ErrorHttp;
use App\Models\LinkPago;
use App\Models\Turno;
use App\Services\CobroService;
use App\Services\MercadoPago;
use App\Services\VistaTurno;

/**
 * Links de pago de Mercado Pago para un turno (por ejemplo, la seña).
 * Como el servidor no es accesible desde internet, Mercado Pago no puede avisar
 * cuándo pagaron: la app pide verificar y la API consulta el estado del pago.
 */
final class LinkPagoController extends Controlador
{
    private const MAXIMO_PENDIENTES = 3;

    private LinkPago $links;
    private Turno $turnos;

    public function __construct()
    {
        parent::__construct();
        $this->links = new LinkPago($this->pdo);
        $this->turnos = new Turno($this->pdo);
    }

    // POST /turnos/:id/links-pago  {monto}
    public function crear(int $turnoId): void
    {
        $turno = $this->verificarDelComplejo($this->turnos->buscarDetalle($turnoId), 'El turno');
        if ($turno['estado'] === 'cancelado') {
            responder(409, ['error' => 'El turno está cancelado']);
        }
        $monto = precioRequerido(leerJson(), 'monto', 'el monto');
        $saldo = (new CobroService($this->pdo))->cuenta($turnoId)['saldo'];
        if ($monto <= 0 || $monto > $saldo) {
            responder(400, ['error' => $saldo > 0
                ? 'El monto tiene que ser mayor a cero y no puede superar lo que falta cobrar (' . pesos($saldo) . ')'
                : 'Este turno ya está pagado']);
        }
        if (count($this->links->pendientesDelTurno($turnoId)) >= self::MAXIMO_PENDIENTES) {
            responder(409, ['error' => 'Este turno ya tiene ' . self::MAXIMO_PENDIENTES . ' links sin pagar. Anulá alguno.']);
        }

        $mercadoPago = new MercadoPago();
        $vence = date('Y-m-d H:i:s', strtotime('+' . LinkPago::HORAS_VIGENCIA . ' hours'));
        // Primero se guarda (para tener el id que identifica al pago) y después se pide el link
        $id = $this->links->crear($turnoId, $monto, '', '', $vence);
        try {
            $link = $mercadoPago->crearLink(
                sprintf(
                    'Turno %s, %s %s - %s',
                    $turno['cancha_nombre'],
                    fechaLarga($turno['fecha']),
                    horaCorta($turno['hora_inicio']),
                    $turno['complejo_nombre']
                ),
                $monto,
                LinkPago::referencia($id),
                $vence
            );
        } catch (\Throwable $e) {
            $this->links->cambiarEstado($id, 'anulado');
            throw $e;
        }
        $this->pdo->prepare('UPDATE links_pago SET preferencia_id = ?, url = ? WHERE id = ?')
            ->execute([$link['id'], $link['url'], $id]);

        responder(201, [
            'link' => $this->links->publico($this->links->buscarPorId($id)),
            'turno' => (new VistaTurno($this->pdo))->detalle($turnoId),
        ]);
    }

    // POST /turnos/:id/links-pago/verificar  (consulta en Mercado Pago los links pendientes del turno)
    public function verificar(int $turnoId): void
    {
        $this->verificarDelComplejo($this->turnos->buscarDetalle($turnoId), 'El turno');
        $pendientes = $this->links->pendientesDelTurno($turnoId);
        $avisos = [];
        if ($pendientes !== []) {
            $mercadoPago = new MercadoPago();
            foreach ($pendientes as $pendiente) {
                $aviso = $this->transaccion(fn () => $this->verificarLink((int) $pendiente['id'], $mercadoPago));
                if ($aviso !== null) {
                    $avisos[] = $aviso;
                }
            }
        }
        $respuesta = ['turno' => (new VistaTurno($this->pdo))->detalle($turnoId)];
        if ($avisos !== []) {
            $respuesta['aviso'] = implode("\n", $avisos);
        }
        responder(200, $respuesta);
    }

    // DELETE /links-pago/:id  (anula el link: también se vence en Mercado Pago)
    public function anular(int $id): void
    {
        $link = $this->verificarDelComplejo($this->links->buscarConDueno($id), 'El link');
        $mercadoPago = new MercadoPago();
        $aviso = $this->transaccion(function () use ($id, $mercadoPago) {
            // Antes de anularlo se mira si no lo pagaron recién
            $aviso = $this->verificarLink($id, $mercadoPago);
            if ($this->links->trabar($id)['estado'] !== 'pendiente') {
                return $aviso ?? 'No se anuló: el link ya estaba pagado o vencido.';
            }
            $mercadoPago->vencerLink($this->links->buscarPorId($id)['preferencia_id']);
            $this->links->cambiarEstado($id, 'anulado');
            return null;
        });
        $respuesta = ['turno' => (new VistaTurno($this->pdo))->detalle((int) $link['turno_id'])];
        if ($aviso !== null) {
            $respuesta['aviso'] = $aviso;
        }
        responder(200, $respuesta);
    }

    /**
     * Si Mercado Pago aprobó el pago del link, lo registra en la cuenta del turno (una sola vez).
     * Si no y ya venció, lo marca vencido. Va dentro de una transacción. Devuelve un aviso o null.
     */
    private function verificarLink(int $id, MercadoPago $mercadoPago): ?string
    {
        $link = $this->links->trabar($id);
        if ($link['estado'] !== 'pendiente') {
            return null;
        }
        $pago = $mercadoPago->pagoAprobado(LinkPago::referencia($id));
        if ($pago !== null) {
            if (abs($pago['monto'] - (float) $link['monto']) > 0.01) {
                throw new ErrorHttp(409, 'El pago aprobado en Mercado Pago no coincide con el monto del link. Revisalo en Mercado Pago.');
            }
            [$pagoId, $aviso] = (new CobroService($this->pdo))->registrarPagoMercadoPago((int) $link['turno_id'], $pago['monto']);
            $this->links->marcarPagado($id, $pago['id'], $pagoId);
            return $aviso;
        }
        if ($link['vence_en'] < date('Y-m-d H:i:s')) {
            $this->links->cambiarEstado($id, 'vencido');
        }
        return null;
    }
}
