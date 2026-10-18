<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Turno;
use PDO;
use Throwable;

/**
 * Lo que revisa la tarea programada bin/avisos.php (cada minuto):
 * - recordatorio 30 minutos antes de los turnos que todavía deben plata;
 * - pagos de Mercado Pago que entraron (sin webhook, se consulta el estado);
 * - reservas de la app cuya seña venció sin pagarse (se libera el horario);
 * - lista de espera: avisar a los jugadores si se liberó el horario que querían;
 * - resumen de la caja del día al dueño, a la hora de cierre.
 * Cada tarea va por separado: si una falla, las otras siguen.
 */
final class AvisosAutomaticos
{
    private const MINUTOS_ANTES = 30;
    // Si el complejo cierra a medianoche, el resumen sale un rato antes, todavía en el mismo día
    private const ULTIMA_HORA_RESUMEN = '23:55';

    private Notificaciones $notificaciones;

    public function __construct(private PDO $pdo)
    {
        $this->notificaciones = new Notificaciones($pdo);
    }

    /** @return list<string> lo que se hizo, para el log */
    public function revisar(): array
    {
        $hecho = [];
        foreach (['recordatorios', 'pagosMercadoPago', 'senasVencidas', 'listaDeEspera', 'resumenesDelDia'] as $tarea) {
            try {
                $hecho[] = "$tarea: " . $this->$tarea();
            } catch (Throwable $e) {
                $hecho[] = "$tarea: ERROR " . $e->getMessage();
                if ($this->pdo->inTransaction()) {
                    $this->pdo->rollBack();
                }
            }
        }
        return $hecho;
    }

    private function recordatorios(): int
    {
        $ahora = date('Y-m-d H:i:s');
        $hasta = date('Y-m-d H:i:s', strtotime('+' . self::MINUTOS_ANTES . ' minutes'));

        // Los turnos fijos de hoy (y de mañana cerca de medianoche) se crean si nadie abrió la agenda
        $agenda = new AgendaService($this->pdo);
        foreach ($this->complejos() as $complejo) {
            $this->transaccion(function () use ($agenda, $complejo, $ahora, $hasta) {
                foreach (array_unique([substr($ahora, 0, 10), substr($hasta, 0, 10)]) as $fecha) {
                    $agenda->materializarFijos((int) $complejo['id'], $fecha);
                }
            });
        }

        $enviados = 0;
        foreach ((new Turno($this->pdo))->porEmpezarSinPagar($ahora, $hasta) as $turno) {
            if (!$this->notificaciones->primeraVez('recordatorio', (string) $turno['id'])) {
                continue;
            }
            $minutos = max(1, (int) round((strtotime("{$turno['fecha']} {$turno['hora_inicio']}") - time()) / 60));
            $saldo = (float) $turno['precio'] + (float) $turno['extras'] - (float) $turno['pagado'];
            $this->notificaciones->alComplejo(
                (int) $turno['complejo_id'],
                "En $minutos minutos juega {$turno['cliente_nombre']}",
                sprintf(
                    '%s a las %s. Todavía no pagó: debe %s.',
                    $turno['cancha_nombre'],
                    horaCorta($turno['hora_inicio']),
                    pesos($saldo)
                ),
                ['turnoId' => (int) $turno['id']]
            );
            $enviados++;
        }
        return $enviados;
    }

    private function pagosMercadoPago(): int
    {
        if (($_ENV['MP_ACCESS_TOKEN'] ?? '') === '') {
            return 0;
        }
        $links = new LinksDePago($this->pdo);
        $mercadoPago = new MercadoPago();
        $pagados = 0;
        $ids = $this->pdo->query("SELECT id FROM links_pago WHERE estado = 'pendiente'")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($ids as $id) {
            try {
                $resultado = $this->transaccion(fn () => $links->verificar((int) $id, $mercadoPago));
            } catch (Throwable $e) {
                // Por ejemplo, Mercado Pago no respondió: se vuelve a intentar en la próxima vuelta
                error_log("[CanchasYa avisos] Link $id: " . $e->getMessage());
                continue;
            }
            if ($resultado['pagado']) {
                $links->avisarPago((int) $id);
                $pagados++;
            }
        }
        return $pagados;
    }

    private function senasVencidas(): int
    {
        return (new Reservas($this->pdo))->liberarVencidas();
    }

    private function listaDeEspera(): int
    {
        return (new ListaEspera($this->pdo))->revisar();
    }

    private function resumenesDelDia(): int
    {
        $hoy = hoy();
        $hora = date('H:i');
        $cobros = new CobroService($this->pdo);
        $agenda = new AgendaService($this->pdo);
        $enviados = 0;

        foreach ($this->complejos() as $complejo) {
            $cierre = min(horaCorta($complejo['hora_cierre']), self::ULTIMA_HORA_RESUMEN);
            if ($hora < $cierre || !$this->notificaciones->primeraVez('resumen', "{$complejo['id']}-$hoy")) {
                continue;
            }
            $this->transaccion(fn () => $agenda->materializarFijos((int) $complejo['id'], $hoy));
            $caja = $cobros->caja((int) $complejo['id'], $hoy);
            $stmt = $this->pdo->prepare(
                "SELECT COUNT(*) FROM turnos t JOIN canchas c ON c.id = t.cancha_id
                 WHERE c.complejo_id = ? AND t.fecha = ? AND t.estado <> 'cancelado'"
            );
            $stmt->execute([(int) $complejo['id'], $hoy]);
            $turnos = (int) $stmt->fetchColumn();
            // Un día sin movimiento no se avisa
            if ($turnos === 0 && $caja['totales']['cantidad'] === 0) {
                continue;
            }

            $this->notificaciones->alComplejo(
                (int) $complejo['id'],
                'Caja de hoy: ' . pesos($caja['totales']['total']),
                $this->textoResumen($turnos, $caja),
                ['pantalla' => 'caja'],
                null,
                true
            );
            $enviados++;
        }
        return $enviados;
    }

    // "12 turnos · Efectivo $ 40.000 · Transferencia $ 30.000. Falta cobrar $ 8.000 de 2 turnos."
    private function textoResumen(int $turnos, array $caja): string
    {
        $partes = [$turnos === 1 ? '1 turno' : "$turnos turnos"];
        $medios = ['efectivo' => 'Efectivo', 'transferencia' => 'Transferencia', 'mercadopago' => 'Mercado Pago'];
        foreach ($medios as $clave => $nombre) {
            if ($caja['totales'][$clave] > 0) {
                $partes[] = "$nombre " . pesos($caja['totales'][$clave]);
            }
        }
        $texto = implode(' · ', $partes) . '.';
        $deben = count($caja['porCobrar']);
        if ($deben > 0) {
            $texto .= sprintf(
                ' Falta cobrar %s de %s.',
                pesos($caja['totalPorCobrar']),
                $deben === 1 ? '1 turno' : "$deben turnos"
            );
        }
        return $texto;
    }

    private function complejos(): array
    {
        return $this->pdo->query('SELECT id, hora_cierre FROM complejos')->fetchAll();
    }

    private function transaccion(callable $accion): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $resultado = $accion();
            $this->pdo->commit();
            return $resultado;
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
