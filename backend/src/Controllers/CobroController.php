<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ErrorHttp;
use App\Models\Consumo;
use App\Models\Pago;
use App\Models\Producto;
use App\Models\Turno;
use App\Services\AgendaService;
use App\Services\CobroService;
use App\Services\Reservas;
use App\Services\VistaTurno;

/**
 * Cobros: pagos y extras de un turno, y la caja del día.
 */
final class CobroController extends Controlador
{
    private Turno $turnos;
    private Pago $pagos;
    private Consumo $consumos;
    private CobroService $cobros;

    public function __construct()
    {
        parent::__construct();
        $this->turnos = new Turno($this->pdo);
        $this->pagos = new Pago($this->pdo);
        $this->consumos = new Consumo($this->pdo);
        $this->cobros = new CobroService($this->pdo);
    }

    // POST /turnos/:id/pagos  {monto, metodo: "efectivo"|"transferencia"}
    public function registrarPago(int $turnoId): void
    {
        $this->verificarDelComplejo($this->turnos->buscarDetalle($turnoId), 'El turno');
        $pago = pagoValido(leerJson());
        $this->transaccion(fn () => $this->cobros->registrarPago($turnoId, $pago['monto'], $pago['metodo']));
        responder(201, ['turno' => $this->detalle($turnoId)]);
    }

    // DELETE /pagos/:id  (para corregir un cobro cargado por error)
    public function borrarPago(int $id): void
    {
        $this->soloDueno();
        $pago = $this->verificarDelComplejo($this->pagos->buscarConDueno($id), 'El pago');
        // Lo confirmó Mercado Pago: si se devuelve, se hace desde Mercado Pago
        if ($pago['metodo'] === Pago::MERCADO_PAGO) {
            responder(409, ['error' => 'Los pagos de Mercado Pago no se borran: si lo devolviste, hacelo desde Mercado Pago.']);
        }
        $turnoId = (int) $pago['turno_id'];
        $this->transaccion(function () use ($id, $turnoId) {
            $this->turnos->trabar($turnoId);
            $this->pagos->borrar($id);
            $this->cobros->actualizarEstadoPago($turnoId);
        });
        responder(200, ['turno' => $this->detalle($turnoId)]);
    }

    /**
     * POST /turnos/:id/consumos
     * {productoId, cantidad} para un producto del catálogo,
     * o {descripcion, precioUnitario, cantidad} para algo suelto.
     */
    public function agregarConsumo(int $turnoId): void
    {
        $this->verificarDelComplejo($this->turnos->buscarDetalle($turnoId), 'El turno');
        $datos = leerJson();
        $cantidad = $datos['cantidad'] ?? 1;
        if (!is_int($cantidad) || $cantidad < 1 || $cantidad > 99) {
            responder(400, ['error' => 'La cantidad tiene que ser un número entre 1 y 99']);
        }

        $productoId = null;
        if (isset($datos['productoId'])) {
            $producto = $this->verificarDelComplejo(
                (new Producto($this->pdo))->buscarConDueno(idRequerido($datos, 'productoId', 'el producto')),
                'El producto'
            );
            if (!$producto['activo']) {
                responder(409, ['error' => 'Ese producto está desactivado']);
            }
            $productoId = (int) $producto['id'];
            $descripcion = $producto['nombre'];
            $precio = (float) $producto['precio'];
        } else {
            // Un extra suelto lleva un precio escrito a mano: el encargado solo usa el catálogo
            if ($this->esEmpleado()) {
                responder(403, ['error' => 'Elegí un producto de la lista. Los extras con precio a mano los carga el dueño.']);
            }
            $descripcion = textoRequerido($datos, 'descripcion', Producto::NOMBRE_MAXIMO, 'la descripción del extra');
            $precio = precioRequerido($datos, 'precioUnitario', 'el precio del extra');
        }

        $this->transaccion(function () use ($turnoId, $productoId, $descripcion, $cantidad, $precio) {
            $this->cobros->trabarParaCobrar($turnoId);
            $this->consumos->crear($turnoId, $productoId, $descripcion, $cantidad, $precio);
            $this->cobros->actualizarEstadoPago($turnoId);
        });
        responder(201, ['turno' => $this->detalle($turnoId)]);
    }

    // DELETE /consumos/:id
    public function borrarConsumo(int $id): void
    {
        $consumo = $this->verificarDelComplejo($this->consumos->buscarConDueno($id), 'El extra');
        $turnoId = (int) $consumo['turno_id'];
        $this->transaccion(function () use ($id, $turnoId) {
            $this->turnos->trabar($turnoId);
            $this->consumos->borrar($id);
            // Si ya se había cobrado, sacar el extra dejaría plata cobrada de más
            $cuenta = $this->cobros->cuenta($turnoId);
            if ($cuenta['pagado'] > $cuenta['total']) {
                throw new ErrorHttp(409, 'Ese extra ya está cobrado: primero borrá el pago y después el extra');
            }
            $this->cobros->actualizarEstadoPago($turnoId);
        });
        responder(200, ['turno' => $this->detalle($turnoId)]);
    }

    /**
     * GET /caja?fecha=AAAA-MM-DD  (sin fecha: hoy)
     * Lo cobrado ese día (por efectivo y transferencia) y lo que falta cobrar de los turnos del día.
     */
    public function caja(): void
    {
        $complejoId = (int) $this->complejoActual()['id'];
        $fecha = $_GET['fecha'] ?? hoy();
        if (!is_string($fecha) || !fechaValida($fecha)) {
            responder(400, ['error' => 'La fecha tiene que tener el formato AAAA-MM-DD']);
        }
        // Una reserva cuya seña venció ya no está por cobrar; los turnos fijos del día sí
        (new Reservas($this->pdo))->liberarVencidas($complejoId);
        $this->transaccion(fn () => (new AgendaService($this->pdo))->materializarFijos($complejoId, $fecha));

        $caja = $this->cobros->caja($complejoId, $fecha);

        responder(200, [
            'fecha' => $fecha,
            'totales' => $caja['totales'],
            'cobros' => array_map(fn (array $c) => [
                ...$this->pagos->publico($c),
                'turno' => [
                    'id' => (int) $c['turno_id'],
                    'fecha' => $c['turno_fecha'],
                    'horaInicio' => horaCorta($c['hora_inicio']),
                    'cancha' => $c['cancha_nombre'],
                    'cliente' => $c['cliente_nombre'],
                ],
            ], $caja['cobros']),
            'porCobrar' => $caja['porCobrar'],
            'totalPorCobrar' => $caja['totalPorCobrar'],
        ]);
    }

    private function detalle(int $turnoId): array
    {
        return (new VistaTurno($this->pdo))->detalle($turnoId);
    }
}
