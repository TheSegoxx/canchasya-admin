<?php

declare(strict_types=1);

namespace App\Services;

use Firebase\JWT\JWT;
use RuntimeException;

/**
 * Cliente de Firebase Cloud Messaging (API HTTP v1).
 * Se autentica con la cuenta de servicio de storage/firebase-cuenta-servicio.json:
 * firma un JWT con su clave privada, lo cambia por un token de acceso de Google (dura 1 hora)
 * y lo guarda en storage/ para no pedirlo en cada envío.
 */
final class Fcm
{
    // El canal que crea la app (MainApplication.kt): sonido y aviso emergente
    public const CANAL = 'avisos';

    private const ALCANCE = 'https://www.googleapis.com/auth/firebase.messaging';
    private const TIEMPO_ESPERA_SEG = 8;

    private string $carpeta;

    public function __construct()
    {
        $this->carpeta = dirname(__DIR__, 2) . '/storage';
    }

    public function configurado(): bool
    {
        return is_file($this->carpeta . '/firebase-cuenta-servicio.json');
    }

    /**
     * Manda la notificación a cada token (en paralelo) y devuelve los tokens
     * que Firebase ya no reconoce (app desinstalada o token vencido) para borrarlos.
     *
     * @param list<string> $tokens
     * @param array<string, string> $datos  llegan a la app al tocar la notificación
     * @return list<string>
     */
    public function enviar(array $tokens, string $titulo, string $cuerpo, array $datos = []): array
    {
        if ($tokens === []) {
            return [];
        }
        $cuenta = $this->cuenta();
        $acceso = $this->tokenDeAcceso($cuenta);
        $url = "https://fcm.googleapis.com/v1/projects/{$cuenta['project_id']}/messages:send";

        $multi = curl_multi_init();
        $pedidos = [];
        foreach ($tokens as $token) {
            $mensaje = ['message' => [
                'token' => $token,
                'notification' => ['title' => $titulo, 'body' => $cuerpo],
                'android' => [
                    'priority' => 'HIGH',
                    'notification' => ['channel_id' => self::CANAL, 'sound' => 'default'],
                ],
            ]];
            if ($datos !== []) {
                $mensaje['message']['data'] = $datos;
            }
            $curl = $this->curl($url, json_encode($mensaje, JSON_UNESCAPED_UNICODE), [
                'Content-Type: application/json',
                "Authorization: Bearer $acceso",
            ]);
            curl_multi_add_handle($multi, $curl);
            $pedidos[$token] = $curl;
        }

        do {
            $estado = curl_multi_exec($multi, $activos);
            if ($activos) {
                curl_multi_select($multi);
            }
        } while ($activos && $estado === CURLM_OK);

        $invalidos = [];
        foreach ($pedidos as $token => $curl) {
            $codigo = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            if ($codigo !== 200) {
                $respuesta = json_decode((string) curl_multi_getcontent($curl), true);
                if ($this->tokenInvalido($codigo, $respuesta)) {
                    $invalidos[] = $token;
                } else {
                    error_log(sprintf(
                        '[CanchasYa API] FCM respondió %d: %s',
                        $codigo,
                        $respuesta['error']['message'] ?? curl_error($curl)
                    ));
                }
            }
            curl_multi_remove_handle($multi, $curl);
            curl_close($curl);
        }
        curl_multi_close($multi);
        return $invalidos;
    }

    // UNREGISTERED: la app se desinstaló o el token cambió; INVALID_ARGUMENT sobre el token: no es un token válido
    private function tokenInvalido(int $codigo, ?array $respuesta): bool
    {
        $error = $respuesta['error'] ?? [];
        foreach ($error['details'] ?? [] as $detalle) {
            if (($detalle['errorCode'] ?? '') === 'UNREGISTERED') {
                return true;
            }
        }
        return $codigo === 404
            || ($codigo === 400 && str_contains((string) ($error['message'] ?? ''), 'registration token'));
    }

    private function cuenta(): array
    {
        $cuenta = json_decode((string) @file_get_contents($this->carpeta . '/firebase-cuenta-servicio.json'), true);
        if (!is_array($cuenta) || !isset($cuenta['project_id'], $cuenta['client_email'], $cuenta['private_key'])) {
            throw new RuntimeException('Falta o no es válido storage/firebase-cuenta-servicio.json');
        }
        return $cuenta;
    }

    private function tokenDeAcceso(array $cuenta): string
    {
        $cache = $this->carpeta . '/fcm-acceso.json';
        $guardado = json_decode((string) @file_get_contents($cache), true);
        // Con un minuto de margen
        if (is_array($guardado) && ($guardado['vence'] ?? 0) > time() + 60) {
            return $guardado['token'];
        }

        $ahora = time();
        $afirmacion = JWT::encode([
            'iss' => $cuenta['client_email'],
            'scope' => self::ALCANCE,
            'aud' => $cuenta['token_uri'] ?? 'https://oauth2.googleapis.com/token',
            'iat' => $ahora,
            'exp' => $ahora + 3600,
        ], $cuenta['private_key'], 'RS256');

        $curl = $this->curl(
            $cuenta['token_uri'] ?? 'https://oauth2.googleapis.com/token',
            http_build_query([
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $afirmacion,
            ]),
            ['Content-Type: application/x-www-form-urlencoded']
        );
        $respuesta = json_decode((string) curl_exec($curl), true);
        $codigo = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        if ($codigo !== 200 || !isset($respuesta['access_token'])) {
            throw new RuntimeException("Google no dio el token de acceso para FCM ($codigo): "
                . ($respuesta['error_description'] ?? $respuesta['error'] ?? $error));
        }

        file_put_contents($cache, json_encode([
            'token' => $respuesta['access_token'],
            'vence' => $ahora + (int) ($respuesta['expires_in'] ?? 3600),
        ]), LOCK_EX);
        return $respuesta['access_token'];
    }

    /** @return \CurlHandle */
    private function curl(string $url, string $cuerpo, array $encabezados)
    {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $cuerpo,
            CURLOPT_HTTPHEADER => $encabezados,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => self::TIEMPO_ESPERA_SEG,
        ]);
        return $curl;
    }
}
