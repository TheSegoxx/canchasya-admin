<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Dispositivo;
use PDO;
use Throwable;

/**
 * Notificaciones push a la gente de un complejo. Son un extra: si Firebase no está
 * configurado o no responde, se registra en el log y la operación principal sigue igual.
 */
final class Notificaciones
{
    private Dispositivo $dispositivos;
    private Fcm $fcm;

    public function __construct(private PDO $pdo)
    {
        $this->dispositivos = new Dispositivo($pdo);
        $this->fcm = new Fcm();
    }

    /**
     * Al dueño y a los encargados (o solo al dueño), menos a quien hizo la acción:
     * esa persona ya lo está viendo en su pantalla.
     *
     * @param array<string, string|int> $datos  por ejemplo ['turnoId' => 12]: la app abre ese turno al tocarla
     */
    public function alComplejo(
        int $complejoId,
        string $titulo,
        string $cuerpo,
        array $datos = [],
        ?int $exceptoUsuarioId = null,
        bool $soloDueno = false
    ): void {
        try {
            if (!$this->fcm->configurado()) {
                return;
            }
            $tokens = $this->dispositivos->tokensDelComplejo($complejoId, !$soloDueno, $exceptoUsuarioId);
            // FCM solo acepta textos en los datos
            $datos = array_map('strval', $datos);
            $this->dispositivos->borrarTokens($this->fcm->enviar($tokens, $titulo, $cuerpo, $datos));
        } catch (Throwable $e) {
            error_log('[CanchasYa API] No se pudo mandar la notificación: ' . $e->getMessage());
        }
    }

    // A los celulares de un usuario (por ejemplo, al jugador que armó la vaquita)
    public function alUsuario(int $usuarioId, string $titulo, string $cuerpo, array $datos = []): void
    {
        try {
            if (!$this->fcm->configurado()) {
                return;
            }
            $tokens = $this->dispositivos->tokensDelUsuario($usuarioId);
            $this->dispositivos->borrarTokens($this->fcm->enviar($tokens, $titulo, $cuerpo, array_map('strval', $datos)));
        } catch (Throwable $e) {
            error_log('[CanchasYa API] No se pudo mandar la notificación: ' . $e->getMessage());
        }
    }

    // "hoy a las 20:00", "mañana a las 20:00" o "sábado 14 de octubre a las 20:00"
    public static function cuando(string $fecha, string $hora): string
    {
        $dia = match ($fecha) {
            hoy() => 'hoy',
            sumarDias(hoy(), 1) => 'mañana',
            default => fechaLarga($fecha),
        };
        return "$dia a las " . horaCorta($hora);
    }

    // Para los avisos automáticos: true solo la primera vez que se pide con ese tipo y referencia
    public function primeraVez(string $tipo, string $referencia): bool
    {
        $stmt = $this->pdo->prepare('INSERT IGNORE INTO avisos_enviados (tipo, referencia) VALUES (?, ?)');
        $stmt->execute([$tipo, $referencia]);
        return $stmt->rowCount() === 1;
    }
}
