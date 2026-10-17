<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Usuario;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use PDOException;
use RuntimeException;
use Throwable;

/**
 * Registro, login con contraseña y login con Google.
 */
final class AuthService
{
    private const EMISORES_GOOGLE = ['accounts.google.com', 'https://accounts.google.com'];
    private const URL_CLAVES_GOOGLE = 'https://www.googleapis.com/oauth2/v3/certs';
    // Hash bcrypt de una clave cualquiera, solo para igualar tiempos en el login
    private const HASH_DE_RELLENO = '$2y$10$tBLTWsR8IjLO/RgcGIw2E.HnFzoiwvUrWyX5g1he.Zv99TNqFpnkm';

    public function __construct(private Usuario $usuarios)
    {
    }

    /** @param array $perfil rol, telefono, ciudad y deportes (ver Usuario::crear) */
    public function registrar(string $nombre, string $email, string $password, array $perfil = []): array
    {
        if ($this->usuarios->buscarPorEmail($email) !== null) {
            responder(409, ['error' => 'Ya existe una cuenta con ese email']);
        }

        // bcrypt genera la sal sola y la guarda dentro del hash
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
        try {
            $id = $this->usuarios->crear($nombre, $email, $hash, null, null, $perfil);
        } catch (PDOException $e) {
            // Dos registros con el mismo email al mismo tiempo: el índice UNIQUE frena al segundo
            if ($e->getCode() === '23000') {
                responder(409, ['error' => 'Ya existe una cuenta con ese email']);
            }
            throw $e;
        }

        return $this->usuarios->buscarPorId($id);
    }

    // Devuelve el usuario si email y contraseña coinciden; si no, null
    public function login(string $email, string $password): ?array
    {
        $usuario = $this->usuarios->buscarPorEmail($email);
        if ($usuario === null) {
            // Se calcula un hash igual: así la respuesta tarda lo mismo y no delata qué emails existen
            password_verify($password, self::HASH_DE_RELLENO);
            return null;
        }
        return $this->usuarios->verificarPassword($usuario, $password) ? $usuario : null;
    }

    /**
     * Verifica el idToken que Google le dio a la app y devuelve [usuario, esNuevo],
     * o null si el token no es válido.
     * Si la cuenta no existe se crea; si existía con el mismo email, se vincula.
     */
    public function loginGoogle(string $idToken): ?array
    {
        $datos = $this->verificarTokenGoogle($idToken);
        if ($datos === null) {
            return null;
        }

        $email = mb_strtolower($datos->email);
        // Se respetan los largos de las columnas (nombre 100, foto_url 255)
        $nombre = mb_substr(trim((string) ($datos->name ?? '')) ?: strtok($email, '@'), 0, 100);
        $foto = isset($datos->picture) && strlen($datos->picture) <= 255 ? $datos->picture : null;

        $usuario = $this->usuarios->buscarPorGoogleId($datos->sub) ?? $this->usuarios->buscarPorEmail($email);
        if ($usuario === null) {
            // Queda como dueño (así funciona la app 1.0), pero la app nueva le pregunta si es jugador o dueño
            $id = $this->usuarios->crear($nombre, $email, null, $datos->sub, $foto, ['rolElegido' => false]);
            return [$this->usuarios->buscarPorId($id), true];
        }

        if ($usuario['google_id'] === null) {
            // Ya tenía cuenta con email y contraseña: se vincula con Google
            $this->usuarios->vincularGoogle((int) $usuario['id'], $datos->sub, $foto);
            $usuario = $this->usuarios->buscarPorId((int) $usuario['id']);
        }

        return [$usuario, false];
    }

    /**
     * Comprueba firma (claves públicas de Google), emisor, audiencia (nuestro
     * Client ID web), vencimiento y que el email esté verificado.
     */
    private function verificarTokenGoogle(string $idToken): ?object
    {
        JWT::$leeway = 60; // tolera hasta 1 minuto de diferencia de reloj

        try {
            $datos = JWT::decode($idToken, JWK::parseKeySet($this->clavesGoogle(false)));
        } catch (Throwable $e) {
            try {
                // Google rota sus claves: si falló con las guardadas, se descargan de nuevo
                $datos = JWT::decode($idToken, JWK::parseKeySet($this->clavesGoogle(true)));
            } catch (Throwable $e) {
                error_log('[CanchasYa API] Token de Google rechazado: ' . $e->getMessage());
                return null;
            }
        }

        if (!in_array($datos->iss ?? '', self::EMISORES_GOOGLE, true)) {
            return null;
        }
        if (($datos->aud ?? '') !== $_ENV['GOOGLE_WEB_CLIENT_ID']) {
            return null;
        }
        if (empty($datos->email) || empty($datos->email_verified) || empty($datos->sub)) {
            return null;
        }
        return $datos;
    }

    // Claves públicas de Google, guardadas en disco durante 1 hora
    private function clavesGoogle(bool $forzarDescarga): array
    {
        $archivo = dirname(__DIR__, 2) . '/storage/google-certs.json';

        if (!$forzarDescarga && is_file($archivo) && filemtime($archivo) > time() - 3600) {
            $guardadas = json_decode((string) file_get_contents($archivo), true);
            if (is_array($guardadas)) {
                return $guardadas;
            }
        }

        $contexto = stream_context_create(['http' => ['timeout' => 10]]);
        $crudo = @file_get_contents(self::URL_CLAVES_GOOGLE, false, $contexto);
        $claves = $crudo === false ? null : json_decode($crudo, true);
        if (!is_array($claves)) {
            throw new RuntimeException('No se pudieron descargar las claves públicas de Google');
        }

        // Si la carpeta storage no se puede escribir, se sigue sin guardar copia
        @file_put_contents($archivo, $crudo);
        return $claves;
    }
}
