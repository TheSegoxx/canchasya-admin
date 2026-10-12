<?php

declare(strict_types=1);

namespace App\Services;

use App\ErrorHttp;
use App\Models\Bloqueo;
use App\Models\Cancha;
use App\Models\FranjaPrecio;
use App\Models\Turno;
use App\Models\TurnoFijo;
use PDO;

/**
 * Reglas de la agenda que comparten turnos, turnos fijos y bloqueos.
 * Los métodos que escriben se llaman dentro de una transacción del controlador.
 */
final class AgendaService
{
    private Turno $turnos;
    private TurnoFijo $fijos;
    private Bloqueo $bloqueos;
    private FranjaPrecio $franjas;

    public function __construct(private PDO $pdo)
    {
        $this->turnos = new Turno($pdo);
        $this->fijos = new TurnoFijo($pdo);
        $this->bloqueos = new Bloqueo($pdo);
        $this->franjas = new FranjaPrecio($pdo);
    }

    /**
     * Traba la fila de la cancha hasta que termine la transacción. Si dos pedidos
     * quieren el mismo horario a la vez, el segundo espera a que el primero
     * guarde su turno y recién ahí controla la superposición: nunca quedan dos.
     */
    public function trabarCancha(int $canchaId): void
    {
        $this->pdo->prepare('SELECT id FROM canchas WHERE id = ? FOR UPDATE')->execute([$canchaId]);
    }

    // Motivo por el que el horario no está libre, o null si se puede reservar
    public function conflicto(int $canchaId, string $fecha, string $inicio, string $fin, int $exceptoTurnoId = 0): ?string
    {
        $ocupado = $this->turnos->superpuestos($canchaId, $fecha, $inicio, $fin, $exceptoTurnoId);
        if ($ocupado !== []) {
            $t = $ocupado[0];
            return sprintf(
                'Ese horario ya está ocupado por %s (%s a %s)',
                $t['cliente_nombre'],
                horaCorta($t['hora_inicio']),
                horaCorta($t['hora_fin'])
            );
        }

        [$desde, $hasta] = self::rango($fecha, $inicio, $fin);
        $bloqueo = $this->bloqueos->superpuesto($canchaId, $desde, $hasta);
        if ($bloqueo !== null) {
            return "La cancha está bloqueada en ese horario ({$bloqueo['motivo']})";
        }
        return null;
    }

    public function verificarLibre(int $canchaId, string $fecha, string $inicio, string $fin, int $exceptoTurnoId = 0): void
    {
        $motivo = $this->conflicto($canchaId, $fecha, $inicio, $fin, $exceptoTurnoId);
        if ($motivo !== null) {
            throw new ErrorHttp(409, $motivo);
        }
    }

    // Precio de la franja horaria en que empieza el turno, o el precio base de la cancha
    public function precio(array $cancha, string $inicio): float
    {
        return $this->franjas->precioEn((int) $cancha['id'], $inicio) ?? (float) $cancha['precio_base'];
    }

    /**
     * Crea los turnos de esa fecha que salen de los turnos fijos.
     * Si ese día el horario está ocupado o bloqueado, ese día se saltea
     * (y se vuelve a intentar si se libera). Va dentro de una transacción.
     */
    public function materializarFijos(int $complejoId, string $fecha, ?int $canchaId = null): void
    {
        $canchas = new Cancha($this->pdo);
        foreach ($this->fijos->pendientes($complejoId, $fecha, $canchaId) as $fijo) {
            $id = (int) $fijo['cancha_id'];
            $this->trabarCancha($id);
            // Con la cancha trabada se vuelve a mirar: otro pedido pudo haberlo creado recién
            if ($this->turnos->existeDelFijo((int) $fijo['id'], $fecha)
                || $this->conflicto($id, $fecha, $fijo['hora_inicio'], $fijo['hora_fin']) !== null) {
                continue;
            }
            $precio = $fijo['precio'] !== null
                ? (float) $fijo['precio']
                : $this->precio($canchas->buscarPorId($id), $fijo['hora_inicio']);

            $this->turnos->crear([
                'canchaId' => $id,
                'clienteId' => (int) $fijo['cliente_id'],
                'turnoFijoId' => (int) $fijo['id'],
                'fecha' => $fecha,
                'horaInicio' => $fijo['hora_inicio'],
                'horaFin' => $fijo['hora_fin'],
                'precio' => $precio,
            ]);
        }
    }

    /**
     * Fecha + horas del día -> DATETIME de inicio y fin.
     * "24:00:00" se convierte en las 00:00 del día siguiente.
     *
     * @return array{0: string, 1: string}
     */
    public static function rango(string $fecha, string $inicio, string $fin): array
    {
        $hasta = $fin === '24:00:00' ? sumarDias($fecha, 1) . ' 00:00:00' : "$fecha $fin";
        return ["$fecha $inicio", $hasta];
    }
}
