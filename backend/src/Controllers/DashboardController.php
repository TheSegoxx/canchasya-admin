<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Cancha;
use App\Models\Movimiento;
use App\Models\Pago;
use App\Models\Turno;

/**
 * Endpoints /dashboard y /movimientos: ingresos (cobros de turnos + otros ingresos),
 * egresos (gastos cargados a mano), balance y estadísticas de un período.
 */
final class DashboardController extends Controlador
{
    private Movimiento $movimientos;

    public function __construct()
    {
        parent::__construct();
        $this->movimientos = new Movimiento($this->pdo);
    }

    // GET /dashboard?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
    public function resumen(): void
    {
        $this->soloDueno();
        $complejo = $this->complejoActual();
        $complejoId = (int) $complejo['id'];
        [$desde, $hasta] = rangoDeFechas();

        // Hasta 31 días se agrupa por día; más largo, por mes ("2026-10")
        $porDia = (strtotime($hasta) - strtotime($desde)) / 86400 < 31;
        $clave = fn (string $fecha) => $porDia ? $fecha : substr($fecha, 0, 7);
        $serie = [];
        for ($f = $desde; $f <= $hasta; $f = sumarDias($f, 1)) {
            $serie[$clave($f)] ??= ['clave' => $clave($f), 'ingresos' => 0.0, 'egresos' => 0.0];
        }

        $ingresosTurnos = 0.0;
        $otrosIngresos = 0.0;
        $egresos = 0.0;
        $billetera = ['efectivo' => 0.0, 'transferencia' => 0.0];
        $porCategoria = ['ingreso' => [], 'egreso' => []];

        foreach ((new Pago($this->pdo))->sumasPorDia($complejoId, $desde, $hasta) as $fila) {
            $monto = (float) $fila['total'];
            $ingresosTurnos += $monto;
            $billetera[$fila['metodo']] += $monto;
            $serie[$clave($fila['dia'])]['ingresos'] += $monto;
        }
        foreach ($this->movimientos->sumasPorDia($complejoId, $desde, $hasta) as $fila) {
            $monto = (float) $fila['total'];
            $esIngreso = $fila['tipo'] === 'ingreso';
            if ($esIngreso) {
                $otrosIngresos += $monto;
            } else {
                $egresos += $monto;
            }
            $billetera[$fila['metodo']] += $esIngreso ? $monto : -$monto;
            $serie[$clave($fila['fecha'])][$esIngreso ? 'ingresos' : 'egresos'] += $monto;
            $porCategoria[$fila['tipo']][$fila['categoria']] = ($porCategoria[$fila['tipo']][$fila['categoria']] ?? 0) + $monto;
        }

        $redondear = fn (float $v) => round($v, 2);
        $categorias = function (array $sumas) use ($redondear): array {
            arsort($sumas);
            return array_map(fn ($c, $m) => ['categoria' => $c, 'monto' => $redondear($m)], array_keys($sumas), $sumas);
        };
        $ingresos = $ingresosTurnos + $otrosIngresos;

        responder(200, [
            'desde' => $desde,
            'hasta' => $hasta,
            'agrupacion' => $porDia ? 'dia' : 'mes',
            'ingresos' => [
                'total' => $redondear($ingresos),
                'turnos' => $redondear($ingresosTurnos),
                'otros' => $redondear($otrosIngresos),
            ],
            'egresos' => $redondear($egresos),
            'balance' => $redondear($ingresos - $egresos),
            // Cuánto quedó en efectivo y cuánto en el banco (ingresos menos egresos de cada uno)
            'billetera' => array_map($redondear, $billetera),
            'serie' => array_values(array_map(
                fn (array $p) => ['clave' => $p['clave'], 'ingresos' => $redondear($p['ingresos']), 'egresos' => $redondear($p['egresos'])],
                $serie
            )),
            'egresosPorCategoria' => $categorias($porCategoria['egreso']),
            'otrosIngresosPorCategoria' => $categorias($porCategoria['ingreso']),
            'ingresosPorCancha' => array_map(
                fn (array $f) => ['canchaId' => (int) $f['id'], 'nombre' => $f['nombre'], 'monto' => $redondear((float) $f['total'])],
                (new Pago($this->pdo))->sumasPorCancha($complejoId, $desde, $hasta)
            ),
            'turnos' => $this->turnos($complejo, $desde, $hasta),
        ]);
    }

    // GET /movimientos?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
    public function listar(): void
    {
        $this->soloDueno();
        $complejoId = (int) $this->complejoActual()['id'];
        [$desde, $hasta] = rangoDeFechas();
        responder(200, [
            'movimientos' => array_map([$this->movimientos, 'publico'], $this->movimientos->listarPorRango($complejoId, $desde, $hasta)),
        ]);
    }

    // POST /movimientos  {tipo, categoria, descripcion?, monto, metodo, fecha}
    public function crear(): void
    {
        $this->soloDueno();
        $complejoId = (int) $this->complejoActual()['id'];
        $datos = leerJson();

        $tipo = textoDe($datos, 'tipo');
        if (!in_array($tipo, Movimiento::TIPOS, true)) {
            responder(400, ['error' => 'El tipo tiene que ser ingreso o egreso']);
        }
        $categoria = textoDe($datos, 'categoria');
        if (!in_array($categoria, Movimiento::CATEGORIAS[$tipo], true)) {
            responder(400, ['error' => 'La categoría no es válida']);
        }
        $descripcion = trim(textoDe($datos, 'descripcion'));
        if (mb_strlen($descripcion) > 100) {
            responder(400, ['error' => 'La descripción no puede superar los 100 caracteres']);
        }
        $pago = pagoValido($datos);
        $fecha = fechaRequerida($datos, 'fecha', 'la fecha');
        if ($fecha > sumarDias(hoy(), 365)) {
            responder(400, ['error' => 'La fecha es demasiado lejana']);
        }

        $id = $this->movimientos->crear($complejoId, [
            'tipo' => $tipo,
            'categoria' => $categoria,
            'descripcion' => $descripcion !== '' ? $descripcion : null,
            'monto' => $pago['monto'],
            'metodo' => $pago['metodo'],
            'fecha' => $fecha,
        ]);
        responder(201, ['movimiento' => $this->movimientos->publico($this->movimientos->buscarPorId($id))]);
    }

    // DELETE /movimientos/:id
    public function borrar(int $id): void
    {
        $this->soloDueno();
        $this->verificarDelComplejo($this->movimientos->buscarConDueno($id), 'El movimiento');
        $this->movimientos->borrar($id);
        responder(204);
    }

    /**
     * Turnos del período y ocupación: minutos reservados sobre los minutos que las
     * canchas habilitadas estuvieron abiertas. La ocupación solo mira los días que
     * ya pasaron (incluido hoy); null si el período es todo futuro.
     */
    private function turnos(array $complejo, string $desde, string $hasta): array
    {
        $turnos = new Turno($this->pdo);
        $cantidad = $turnos->estadisticas((int) $complejo['id'], $desde, $hasta);

        $ultimoDia = min($hasta, hoy());
        $ocupacion = null;
        if ($desde <= $ultimoDia) {
            $dias = (int) round((strtotime($ultimoDia) - strtotime($desde)) / 86400) + 1;
            $habilitadas = count(array_filter(
                (new Cancha($this->pdo))->listarPorComplejo((int) $complejo['id']),
                fn (array $c) => (bool) $c['habilitada']
            ));
            $abierto = minutosDe($complejo['hora_cierre']) - minutosDe($complejo['hora_apertura']);
            $disponibles = $dias * $habilitadas * $abierto;
            $minutosReservados = $turnos->estadisticas((int) $complejo['id'], $desde, $ultimoDia)['minutos'];
            $ocupacion = $disponibles > 0 ? round(min(1, $minutosReservados / $disponibles), 3) : null;
        }

        return ['reservados' => $cantidad['reservados'], 'cancelados' => $cantidad['cancelados'], 'ocupacion' => $ocupacion];
    }
}
