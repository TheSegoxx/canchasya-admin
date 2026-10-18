<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Bloqueo;
use App\Models\Cancha;
use App\Models\Complejo;
use App\Models\FranjaPrecio;
use App\Models\Turno;
use App\Services\AgendaService;
use App\Services\Reservas;

/**
 * Endpoint /agenda: todo lo que la app necesita para dibujar un día
 * (horario del complejo, canchas con sus precios, turnos y bloqueos).
 */
final class AgendaController extends Controlador
{
    // GET /agenda?fecha=AAAA-MM-DD  (sin fecha: hoy)
    public function dia(): void
    {
        $complejo = $this->complejoActual();
        $complejoId = (int) $complejo['id'];
        $fecha = $_GET['fecha'] ?? hoy();
        if (!is_string($fecha) || !fechaValida($fecha)) {
            responder(400, ['error' => 'La fecha tiene que tener el formato AAAA-MM-DD']);
        }

        // Antes de leer, se liberan las reservas que no pagaron la seña a tiempo
        // y se crean los turnos que salen de los turnos fijos de ese día
        (new Reservas($this->pdo))->liberarVencidas($complejoId);
        $this->transaccion(fn () => (new AgendaService($this->pdo))->materializarFijos($complejoId, $fecha));

        $canchas = new Cancha($this->pdo);
        $franjas = new FranjaPrecio($this->pdo);
        $turnos = new Turno($this->pdo);
        $bloqueos = new Bloqueo($this->pdo);
        $datosComplejo = (new Complejo($this->pdo))->publico($complejo);

        responder(200, [
            'fecha' => $fecha,
            'complejo' => [
                'nombre' => $datosComplejo['nombre'],
                'direccion' => $datosComplejo['direccion'],
                'ubicacion' => $datosComplejo['ubicacion'],
                'horaApertura' => $datosComplejo['horaApertura'],
                'horaCierre' => $datosComplejo['horaCierre'],
            ],
            // Con sus franjas, para que la app calcule el precio al cargar un turno
            'canchas' => array_map(
                fn (array $c) => [
                    ...$canchas->publico($c),
                    'franjas' => array_map([$franjas, 'publico'], $franjas->listarPorCancha((int) $c['id'])),
                ],
                $canchas->listarPorComplejo($complejoId)
            ),
            'turnos' => array_map([$turnos, 'publico'], $turnos->listarPorFecha($complejoId, $fecha)),
            'bloqueos' => array_map(
                fn (array $b) => $bloqueos->publico($b, $fecha),
                $bloqueos->listarPorFecha($complejoId, $fecha)
            ),
        ]);
    }
}
