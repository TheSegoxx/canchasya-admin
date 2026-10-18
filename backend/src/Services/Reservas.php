<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Turno;
use PDO;
use Throwable;

/**
 * Reglas de las reservas que hacen los jugadores desde la app: la seña que pide el complejo,
 * hasta cuándo hay para pagarla y la liberación de los horarios cuya seña no se pagó.
 */
final class Reservas
{
    private Turno $turnos;

    public function __construct(private PDO $pdo)
    {
        $this->turnos = new Turno($pdo);
    }

    // La seña es un porcentaje del precio, redondeado al peso (null si el complejo no pide seña)
    public static function montoSena(float $precio, int $porcentaje): ?float
    {
        $sena = round($precio * $porcentaje / 100);
        return $porcentaje > 0 && $sena > 0 ? $sena : null;
    }

    // Hay $minutos para pagar la seña, pero nunca después de que empiece el turno
    public static function venceSena(string $fecha, string $horaInicio, int $minutos): string
    {
        return date('Y-m-d H:i:s', min(strtotime("+$minutos minutes"), strtotime("$fecha $horaInicio")));
    }

    /**
     * Cancela las reservas (de un complejo, de un jugador o de todos) cuya seña venció sin pagarse,
     * así el horario vuelve a estar libre. Antes se consulta en Mercado Pago si la pagaron a último
     * momento. Va fuera de las transacciones (llama a Mercado Pago). Devuelve cuántas canceló.
     */
    public function liberarVencidas(?int $complejoId = null, ?int $usuarioId = null): int
    {
        $ids = $this->turnos->senasVencidas($complejoId, $usuarioId);
        if ($ids === []) {
            return 0;
        }
        $this->verificarLinks($ids);

        $canceladas = [];
        foreach ($ids as $id) {
            $this->pdo->beginTransaction();
            try {
                $this->turnos->trabar($id);
                $cancelada = $this->turnos->cancelarSiNoPagoLaSena($id);
                $this->pdo->commit();
            } catch (Throwable $e) {
                $this->pdo->rollBack();
                throw $e;
            }
            if ($cancelada) {
                $canceladas[] = $id;
                $this->avisarLiberada($id);
            }
        }
        // Normalmente el link ya venció junto con la seña; si quedó alguno abierto, se anula
        (new LinksDePago($this->pdo))->anularDeTurnosCancelados($canceladas);
        return count($canceladas);
    }

    /**
     * Consulta en Mercado Pago los links pendientes de esos turnos y registra los que se pagaron
     * (con la notificación al complejo). Si Mercado Pago no está configurado o no responde, no hace
     * nada: la tarea automática lo vuelve a intentar. Devuelve true si entró algún pago.
     *
     * @param list<int> $turnoIds
     */
    public function verificarLinks(array $turnoIds): bool
    {
        if ($turnoIds === [] || trim($_ENV['MP_ACCESS_TOKEN'] ?? '') === '') {
            return false;
        }
        $marcas = implode(', ', array_fill(0, count($turnoIds), '?'));
        $stmt = $this->pdo->prepare("SELECT id FROM links_pago WHERE turno_id IN ($marcas) AND estado = 'pendiente'");
        $stmt->execute(array_values($turnoIds));
        $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
        if ($ids === []) {
            return false;
        }

        $links = new LinksDePago($this->pdo);
        $mercadoPago = new MercadoPago();
        $pagado = false;
        foreach ($ids as $id) {
            $this->pdo->beginTransaction();
            try {
                $resultado = $links->verificar((int) $id, $mercadoPago);
                $this->pdo->commit();
            } catch (Throwable $e) {
                $this->pdo->rollBack();
                error_log("[CanchasYa API] No se pudo verificar el link $id: " . $e->getMessage());
                continue;
            }
            if ($resultado['pagado']) {
                $links->avisarPago((int) $id);
                $pagado = true;
            }
        }
        return $pagado;
    }

    // "Se liberó un horario: Sofía Herrera no pagó la seña · Cancha 1, hoy a las 20:00"
    private function avisarLiberada(int $turnoId): void
    {
        $turno = $this->turnos->buscarDetalle($turnoId);
        (new Notificaciones($this->pdo))->alComplejo(
            (int) $turno['complejo_id'],
            'Se liberó un horario',
            sprintf(
                '%s no pagó la seña a tiempo · %s, %s',
                $turno['cliente_nombre'],
                $turno['cancha_nombre'],
                Notificaciones::cuando($turno['fecha'], $turno['hora_inicio'])
            ),
            ['turnoId' => $turnoId]
        );
    }
}
