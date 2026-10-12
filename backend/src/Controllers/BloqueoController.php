<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ErrorHttp;
use App\Models\Bloqueo;
use App\Models\Cancha;
use App\Models\Turno;
use App\Services\AgendaService;

/**
 * Endpoints /bloqueos: cerrar una o varias canchas un rato (lluvia, mantenimiento, evento).
 */
final class BloqueoController extends Controlador
{
    private Bloqueo $bloqueos;

    public function __construct()
    {
        parent::__construct();
        $this->bloqueos = new Bloqueo($this->pdo);
    }

    /**
     * POST /bloqueos  {canchaIds: [], fecha, horaDesde, horaHasta, motivo, cancelarTurnos?}
     * Si hay turnos en ese horario responde 409 con la lista (turnosEnConflicto);
     * con cancelarTurnos = true los cancela y bloquea igual.
     */
    public function crear(): void
    {
        $complejoId = (int) $this->complejoActual()['id'];
        $datos = leerJson();

        $ids = $datos['canchaIds'] ?? null;
        if (!is_array($ids) || $ids === [] || array_filter($ids, 'is_int') !== $ids) {
            responder(400, ['error' => 'Elegí al menos una cancha']);
        }
        // Siempre en el mismo orden: dos pedidos que traban varias canchas no se bloquean entre sí
        $ids = array_unique($ids);
        sort($ids);
        $canchas = new Cancha($this->pdo);
        $nombres = [];
        foreach ($ids as $id) {
            $nombres[$id] = $this->verificarDelComplejo($canchas->buscarConDueno($id), 'La cancha')['nombre'];
        }

        $fecha = fechaRequerida($datos, 'fecha', 'la fecha');
        if ($fecha < hoy()) {
            responder(400, ['error' => 'No se puede bloquear un día que ya pasó']);
        }
        $desde = horaRequerida($datos, 'horaDesde', 'la hora de inicio');
        $hasta = horaRequerida($datos, 'horaHasta', 'la hora de fin', true);
        if ($desde >= $hasta) {
            responder(400, ['error' => 'La hora de fin tiene que ser posterior a la de inicio']);
        }
        $motivo = textoRequerido($datos, 'motivo', Bloqueo::MOTIVO_MAXIMO, 'el motivo');
        $cancelarTurnos = booleanoOpcional($datos, 'cancelarTurnos', 'cancelarTurnos');
        [$inicio, $fin] = AgendaService::rango($fecha, $desde, $hasta);

        $turnos = new Turno($this->pdo);
        $cancelados = $this->transaccion(function () use (
            $ids, $nombres, $complejoId, $fecha, $desde, $hasta, $inicio, $fin, $motivo, $cancelarTurnos, $turnos
        ) {
            $agenda = new AgendaService($this->pdo);
            $afectados = [];
            foreach ($ids as $id) {
                $agenda->trabarCancha($id);
                $agenda->materializarFijos($complejoId, $fecha, $id);
                $existente = $this->bloqueos->superpuesto($id, $inicio, $fin);
                if ($existente !== null) {
                    throw new ErrorHttp(409, "{$nombres[$id]} ya está bloqueada en parte de ese horario ({$existente['motivo']})");
                }
                // Los ya jugados quedan como están: solo se cancelan los que todavía no se jugaron
                $pendientes = array_filter(
                    $turnos->superpuestos($id, $fecha, $desde, $hasta),
                    fn (array $t) => $t['estado'] === 'confirmado'
                );
                array_push($afectados, ...$pendientes);
            }

            if ($afectados !== [] && !$cancelarTurnos) {
                $cantidad = count($afectados);
                throw new ErrorHttp(409, $cantidad === 1 ? 'Hay 1 turno en ese horario' : "Hay $cantidad turnos en ese horario", [
                    'turnosEnConflicto' => array_map([$turnos, 'publico'], $afectados),
                ]);
            }
            foreach ($afectados as $turno) {
                $turnos->cambiarEstado((int) $turno['id'], 'cancelado');
            }
            foreach ($ids as $id) {
                $this->bloqueos->crear($id, $inicio, $fin, $motivo);
            }
            return $afectados;
        });

        // Los cancelados vuelven para que la app ofrezca avisarles por WhatsApp
        responder(201, [
            'cancelados' => array_map(
                fn (array $t) => [...$turnos->publico($t), 'estado' => 'cancelado'],
                $cancelados
            ),
        ]);
    }

    // DELETE /bloqueos/:id
    public function borrar(int $id): void
    {
        $this->verificarDelComplejo($this->bloqueos->buscarConDueno($id), 'El bloqueo');
        $this->bloqueos->borrar($id);
        responder(204);
    }
}
