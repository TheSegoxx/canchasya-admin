<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

/**
 * Pronóstico por hora para el día de un turno, con Open-Meteo (gratis y sin clave).
 * Se manda solo la ubicación del complejo (nunca datos de personas) y se guarda una hora
 * en clima_cache para no pedirlo de más. Si no hay ubicación, el día está muy lejos o el
 * servicio no responde, no hay pronóstico (la app simplemente no lo muestra).
 */
final class Clima
{
    private const URL = 'https://api.open-meteo.com/v1/forecast';
    private const TIEMPO_ESPERA_SEG = 6;
    private const DIAS_DE_PRONOSTICO = 15;
    private const MINUTOS_EN_CACHE = 60;

    public function __construct(private PDO $pdo)
    {
    }

    /**
     * Las horas del día: [{hora: "17:00", temperatura: 18.4, lluvia: 30, codigo: 2}] (lluvia = % de probabilidad;
     * codigo = el de la Organización Meteorológica Mundial). Lista vacía si no hay pronóstico.
     *
     * @return list<array{hora: string, temperatura: float, lluvia: int, codigo: int}>
     */
    public function delDia(array $complejo, string $fecha): array
    {
        if ($complejo['latitud'] === null || $fecha < hoy() || $fecha > sumarDias(hoy(), self::DIAS_DE_PRONOSTICO)) {
            return [];
        }
        $stmt = $this->pdo->prepare('SELECT datos, actualizado_en FROM clima_cache WHERE complejo_id = ? AND fecha = ?');
        $stmt->execute([(int) $complejo['id'], $fecha]);
        $guardado = $stmt->fetch();
        if ($guardado && strtotime($guardado['actualizado_en']) > time() - self::MINUTOS_EN_CACHE * 60) {
            return json_decode($guardado['datos'], true) ?? [];
        }

        $horas = $this->pedir((float) $complejo['latitud'], (float) $complejo['longitud'], $fecha);
        if ($horas === null) {
            // Si el servicio no responde, sirve el último pronóstico que se tenga
            return $guardado ? (json_decode($guardado['datos'], true) ?? []) : [];
        }
        $this->pdo->prepare(
            'INSERT INTO clima_cache (complejo_id, fecha, datos, actualizado_en) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE datos = VALUES(datos), actualizado_en = VALUES(actualizado_en)'
        )->execute([(int) $complejo['id'], $fecha, json_encode($horas), date('Y-m-d H:i:s')]);
        return $horas;
    }

    /** @return list<array{hora: string, temperatura: float, lluvia: int, codigo: int}>|null */
    private function pedir(float $latitud, float $longitud, string $fecha): ?array
    {
        $curl = curl_init(self::URL . '?' . http_build_query([
            'latitude' => $latitud,
            'longitude' => $longitud,
            'hourly' => 'temperature_2m,precipitation_probability,weather_code',
            'timezone' => 'America/Argentina/Buenos_Aires',
            'start_date' => $fecha,
            'end_date' => $fecha,
        ]));
        curl_setopt_array($curl, [
            CURLOPT_HTTPHEADER => ['User-Agent: CanchasYa (reservas de canchas)', 'Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => self::TIEMPO_ESPERA_SEG,
        ]);
        $cuerpo = curl_exec($curl);
        $codigo = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $falla = curl_error($curl);
        curl_close($curl);
        $datos = $cuerpo !== false && $codigo === 200 ? json_decode((string) $cuerpo, true) : null;
        $porHora = $datos['hourly'] ?? null;
        if (!is_array($porHora) || !is_array($porHora['time'] ?? null)) {
            error_log("[CanchasYa API] Open-Meteo respondió $codigo $falla");
            return null;
        }

        $horas = [];
        foreach ($porHora['time'] as $i => $momento) {
            $horas[] = [
                'hora' => substr((string) $momento, 11, 5),
                'temperatura' => round((float) ($porHora['temperature_2m'][$i] ?? 0), 1),
                'lluvia' => (int) ($porHora['precipitation_probability'][$i] ?? 0),
                'codigo' => (int) ($porHora['weather_code'][$i] ?? 0),
            ];
        }
        return $horas;
    }
}
