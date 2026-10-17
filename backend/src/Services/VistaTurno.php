<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Complejo;
use App\Models\Consumo;
use App\Models\LinkPago;
use App\Models\Pago;
use App\Models\Turno;
use App\Models\TurnoFijo;
use PDO;

/**
 * El turno completo como lo muestra la pantalla del turno:
 * cancha, complejo, turno fijo y la cuenta (extras y pagos).
 */
final class VistaTurno
{
    public function __construct(private PDO $pdo)
    {
    }

    public function detalle(int $id): array
    {
        $turnos = new Turno($this->pdo);
        $consumos = new Consumo($this->pdo);
        $pagos = new Pago($this->pdo);
        $links = new LinkPago($this->pdo);

        $fila = $turnos->buscarDetalle($id);
        $fijo = $fila['turno_fijo_id'] !== null ? (new TurnoFijo($this->pdo))->buscarPorId((int) $fila['turno_fijo_id']) : null;
        return [
            ...$turnos->publico($fila),
            'cancha' => ['id' => (int) $fila['cancha_id'], 'nombre' => $fila['cancha_nombre'], 'deporte' => $fila['cancha_deporte']],
            'complejo' => [
                'nombre' => $fila['complejo_nombre'],
                'direccion' => $fila['complejo_direccion'],
                'ubicacion' => Complejo::ubicacion($fila, 'complejo_'),
            ],
            'fijo' => $fijo !== null ? [
                'id' => (int) $fijo['id'],
                'diaSemana' => (int) $fijo['dia_semana'],
                'fechaHasta' => $fijo['fecha_hasta'],
            ] : null,
            'consumos' => array_map([$consumos, 'publico'], $consumos->listarPorTurno($id)),
            'pagos' => array_map([$pagos, 'publico'], $pagos->listarPorTurno($id)),
            // Links de Mercado Pago (sin los anulados)
            'linksPago' => array_values(array_map(
                [$links, 'publico'],
                array_filter($links->listarPorTurno($id), fn (array $l) => $l['estado'] !== 'anulado')
            )),
        ];
    }
}
