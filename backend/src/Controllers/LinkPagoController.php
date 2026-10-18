<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\LinkPago;
use App\Models\Turno;
use App\Services\CobroService;
use App\Services\LinksDePago;
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
    private LinksDePago $verificador;

    public function __construct()
    {
        parent::__construct();
        $this->links = new LinkPago($this->pdo);
        $this->turnos = new Turno($this->pdo);
        $this->verificador = new LinksDePago($this->pdo);
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

        $vence = date('Y-m-d H:i:s', strtotime('+' . LinkPago::HORAS_VIGENCIA . ' hours'));
        $link = $this->verificador->crear($turno, $monto, $vence, new MercadoPago());

        responder(201, [
            'link' => $this->links->publico($link),
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
                $id = (int) $pendiente['id'];
                $resultado = $this->transaccion(fn () => $this->verificador->verificar($id, $mercadoPago));
                if ($resultado['pagado']) {
                    $this->verificador->avisarPago($id, $this->usuarioActual());
                }
                if ($resultado['aviso'] !== null) {
                    $avisos[] = $resultado['aviso'];
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
        [$pagado, $aviso] = $this->transaccion(function () use ($id, $mercadoPago) {
            // Antes de anularlo se mira si no lo pagaron recién
            $resultado = $this->verificador->verificar($id, $mercadoPago);
            if ($this->links->trabar($id)['estado'] !== 'pendiente') {
                return [$resultado['pagado'], $resultado['aviso'] ?? 'No se anuló: el link ya estaba pagado o vencido.'];
            }
            $mercadoPago->vencerLink($this->links->buscarPorId($id)['preferencia_id']);
            $this->links->cambiarEstado($id, 'anulado');
            return [false, null];
        });
        if ($pagado) {
            $this->verificador->avisarPago($id, $this->usuarioActual());
        }
        $respuesta = ['turno' => (new VistaTurno($this->pdo))->detalle((int) $link['turno_id'])];
        if ($aviso !== null) {
            $respuesta['aviso'] = $aviso;
        }
        responder(200, $respuesta);
    }
}
