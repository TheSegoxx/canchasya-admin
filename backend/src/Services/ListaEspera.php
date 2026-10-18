<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Espera;
use PDO;
use Throwable;

/**
 * Avisa a los jugadores de la lista de espera cuando se libera el horario que querían
 * (se canceló un turno, venció una seña, se quitó un bloqueo...). Se avisa a todos los que
 * esperaban ese horario: el primero que reserva se lo queda. Va fuera de las transacciones.
 */
final class ListaEspera
{
    private Espera $esperas;
    private AgendaService $agenda;

    public function __construct(private PDO $pdo)
    {
        $this->esperas = new Espera($pdo);
        $this->agenda = new AgendaService($pdo);
    }

    // Revisa las esperas de una cancha (o de todas). Devuelve a cuántos avisó. Nunca corta la operación principal.
    public function revisar(?int $canchaId = null): int
    {
        try {
            return $this->avisarLiberadas($canchaId);
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            error_log('[CanchasYa API] No se pudo revisar la lista de espera: ' . $e->getMessage());
            return 0;
        }
    }

    private function avisarLiberadas(?int $canchaId): int
    {
        $avisados = 0;
        $notificaciones = new Notificaciones($this->pdo);
        foreach ($this->esperas->pendientes($canchaId) as $espera) {
            $fin = horaDe(minutosDe($espera['hora_inicio']) + (int) $espera['duracion_min']);
            // Un turno fijo de ese día cuenta como ocupado aunque nadie haya abierto la agenda
            $this->pdo->beginTransaction();
            try {
                $this->agenda->materializarFijos((int) $espera['complejo_id'], $espera['fecha'], (int) $espera['cancha_id']);
                $this->pdo->commit();
            } catch (Throwable $e) {
                $this->pdo->rollBack();
                throw $e;
            }
            if ($this->agenda->conflicto((int) $espera['cancha_id'], $espera['fecha'], $espera['hora_inicio'], $fin) !== null) {
                continue;
            }
            $this->esperas->marcarAvisada((int) $espera['id']);
            $notificaciones->alUsuario(
                (int) $espera['usuario_id'],
                '¡Se liberó el horario que esperabas!',
                sprintf(
                    '%s en %s, %s. Reservalo antes que otro.',
                    $espera['cancha_nombre'],
                    $espera['complejo_nombre'],
                    Notificaciones::cuando($espera['fecha'], $espera['hora_inicio'])
                ),
                ['pantalla' => 'reservar', 'complejoId' => (int) $espera['complejo_id'], 'canchaId' => (int) $espera['cancha_id']]
            );
            $avisados++;
        }
        return $avisados;
    }
}
