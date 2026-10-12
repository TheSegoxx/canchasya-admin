<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\CodigoRecuperacion;
use App\Models\Usuario;
use PDO;
use Throwable;

/**
 * "¿Olvidaste tu contraseña?": se manda un código de 6 números por email,
 * válido 15 minutos y con 5 intentos; con el código correcto se elige una contraseña nueva.
 */
final class RecuperacionPassword
{
    private const MINUTOS_DE_VALIDEZ = 15;
    private const MAXIMO_DE_INTENTOS = 5;
    private const SEGUNDOS_ENTRE_CODIGOS = 60;
    // Hash bcrypt de un código cualquiera, solo para igualar tiempos cuando el email no existe
    private const HASH_DE_RELLENO = '$2y$10$tBLTWsR8IjLO/RgcGIw2E.HnFzoiwvUrWyX5g1he.Zv99TNqFpnkm';

    private Usuario $usuarios;
    private CodigoRecuperacion $codigos;

    public function __construct(private PDO $pdo, private Correo $correo)
    {
        $this->usuarios = new Usuario($pdo);
        $this->codigos = new CodigoRecuperacion($pdo);
    }

    // Si el email no tiene cuenta no hace nada: la API responde lo mismo para no delatar qué emails existen
    public function pedirCodigo(string $email): void
    {
        $usuario = $this->usuarios->buscarPorEmail($email);
        if ($usuario === null) {
            return;
        }
        // Un correo por minuto como máximo (el anterior sigue sirviendo)
        $desdeElUltimo = $this->codigos->segundosDesdeElUltimo((int) $usuario['id']);
        if ($desdeElUltimo !== null && $desdeElUltimo < self::SEGUNDOS_ENTRE_CODIGOS) {
            return;
        }

        $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $this->codigos->crear(
            (int) $usuario['id'],
            password_hash($codigo, PASSWORD_BCRYPT, ['cost' => 10]),
            self::MINUTOS_DE_VALIDEZ
        );

        try {
            $this->correo->enviar(
                $usuario['email'],
                $usuario['nombre'],
                "$codigo es tu código de CanchasYa Admin",
                $this->html($usuario['nombre'], $codigo),
                $this->texto($usuario['nombre'], $codigo)
            );
        } catch (Throwable $e) {
            // Se registra para el administrador; al usuario no se le dice (delataría que el email existe)
            error_log('[CanchasYa API] No se pudo enviar el código de recuperación: ' . $e->getMessage());
        }
    }

    /**
     * Cambia la contraseña si el código es correcto y devuelve el usuario;
     * null si el email no existe o el código es incorrecto, venció o ya se usó.
     */
    public function restablecer(string $email, string $codigo, string $password): ?array
    {
        $usuario = $this->usuarios->buscarPorEmail($email);
        if ($usuario === null) {
            password_verify($codigo, self::HASH_DE_RELLENO);
            return null;
        }

        $this->pdo->beginTransaction();
        try {
            $fila = $this->codigos->vigenteParaActualizar((int) $usuario['id']);
            $correcto = $fila !== null
                && (int) $fila['intentos'] < self::MAXIMO_DE_INTENTOS
                && password_verify($codigo, $fila['codigo_hash']);

            if ($correcto) {
                $this->codigos->marcarUsado((int) $fila['id']);
                $this->usuarios->cambiarPassword(
                    (int) $usuario['id'],
                    password_hash($password, PASSWORD_BCRYPT, ['cost' => 10])
                );
            } elseif ($fila !== null) {
                $this->codigos->sumarIntento((int) $fila['id']);
            }
            // El intento fallido también se guarda
            $this->pdo->commit();
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return $correcto ? $this->usuarios->buscarPorId((int) $usuario['id']) : null;
    }

    private function texto(string $nombre, string $codigo): string
    {
        $minutos = self::MINUTOS_DE_VALIDEZ;
        return "Hola $nombre:\n\n"
            . "Tu código para crear una contraseña nueva en CanchasYa Admin es: $codigo\n\n"
            . "Vence en $minutos minutos. Si no lo pediste, ignorá este correo: tu contraseña no cambia.";
    }

    private function html(string $nombre, string $codigo): string
    {
        $nombre = htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8');
        $minutos = self::MINUTOS_DE_VALIDEZ;
        return <<<HTML
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2933">
              <h2 style="color:#1b7f3b">CanchasYa Admin</h2>
              <p>Hola $nombre:</p>
              <p>Tu código para crear una contraseña nueva es:</p>
              <p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center">$codigo</p>
              <p>Vence en $minutos minutos.</p>
              <p style="color:#6b7280;font-size:13px">Si no lo pediste, ignorá este correo: tu contraseña no cambia.</p>
            </div>
            HTML;
    }
}
