<?php

declare(strict_types=1);

namespace App\Services;

use App\ErrorHttp;

/**
 * Busca las coordenadas de una dirección con Nominatim (OpenStreetMap): gratis y sin clave.
 * Sus reglas piden identificarse con un User-Agent y no hacer más de un pedido por segundo;
 * acá solo lo usa el dueño al cargar la ubicación de su complejo.
 */
final class Geocodificador
{
    private const URL = 'https://nominatim.openstreetmap.org/search';
    private const TIEMPO_ESPERA_SEG = 8;

    /** @return array{latitud: float, longitud: float, encontrada: string}|null null si no la encontró */
    public function buscar(string $direccion): ?array
    {
        $curl = curl_init(self::URL . '?' . http_build_query([
            'q' => $direccion,
            'format' => 'jsonv2',
            'limit' => 1,
            'countrycodes' => 'ar',
            'accept-language' => 'es',
        ]));
        curl_setopt_array($curl, [
            CURLOPT_HTTPHEADER => ['User-Agent: CanchasYa Admin (gestion de complejos deportivos)', 'Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => self::TIEMPO_ESPERA_SEG,
        ]);
        $cuerpo = curl_exec($curl);
        $codigo = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);

        if ($cuerpo === false || $codigo !== 200) {
            error_log("[CanchasYa API] Nominatim respondió $codigo $error");
            throw new ErrorHttp(502, 'No se pudo buscar la dirección. Probá de nuevo en un rato.');
        }
        $resultado = json_decode((string) $cuerpo, true)[0] ?? null;
        if (!is_array($resultado) || !isset($resultado['lat'], $resultado['lon'])) {
            return null;
        }
        return [
            'latitud' => round((float) $resultado['lat'], 6),
            'longitud' => round((float) $resultado['lon'], 6),
            'encontrada' => (string) ($resultado['display_name'] ?? ''),
        ];
    }
}
