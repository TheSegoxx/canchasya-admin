<?php

declare(strict_types=1);

namespace App\Services;

use App\ErrorHttp;
use App\Models\Partido;
use App\Models\Torneo;
use PDO;

/**
 * Reglas de los torneos: tabla de posiciones, pase de ronda en eliminación
 * y cuándo hay campeón. Los métodos que escriben van dentro de una transacción.
 */
final class TorneoService
{
    // Puntos por partido en las ligas
    public const PUNTOS_GANADO = 3;
    public const PUNTOS_EMPATE = 1;

    private Partido $partidos;
    private Torneo $torneos;

    public function __construct(private PDO $pdo)
    {
        $this->partidos = new Partido($pdo);
        $this->torneos = new Torneo($pdo);
    }

    /**
     * Tabla de la liga: puntos, después diferencia de goles (o sets), después goles a favor.
     *
     * @return list<array{equipoId: int, jugados: int, ganados: int, empatados: int, perdidos: int, aFavor: int, enContra: int, puntos: int}>
     */
    public static function tabla(array $equipos, array $partidos): array
    {
        $filas = [];
        foreach ($equipos as $e) {
            $filas[(int) $e['id']] = [
                'equipoId' => (int) $e['id'],
                'nombre' => $e['nombre'],
                'jugados' => 0, 'ganados' => 0, 'empatados' => 0, 'perdidos' => 0,
                'aFavor' => 0, 'enContra' => 0, 'puntos' => 0,
            ];
        }
        foreach ($partidos as $p) {
            if ($p['resultado_local'] === null || $p['local_id'] === null || $p['visitante_id'] === null) {
                continue;
            }
            $cruce = [
                [(int) $p['local_id'], (int) $p['resultado_local'], (int) $p['resultado_visitante']],
                [(int) $p['visitante_id'], (int) $p['resultado_visitante'], (int) $p['resultado_local']],
            ];
            foreach ($cruce as [$id, $propios, $ajenos]) {
                $f = &$filas[$id];
                $f['jugados']++;
                $f['aFavor'] += $propios;
                $f['enContra'] += $ajenos;
                if ($propios > $ajenos) {
                    $f['ganados']++;
                    $f['puntos'] += self::PUNTOS_GANADO;
                } elseif ($propios === $ajenos) {
                    $f['empatados']++;
                    $f['puntos'] += self::PUNTOS_EMPATE;
                } else {
                    $f['perdidos']++;
                }
                unset($f);
            }
        }
        $filas = array_values($filas);
        usort($filas, fn ($a, $b) => [$b['puntos'], $b['aFavor'] - $b['enContra'], $b['aFavor'], $a['nombre']]
            <=> [$a['puntos'], $a['aFavor'] - $a['enContra'], $a['aFavor'], $b['nombre']]);
        return array_map(function (array $f) {
            unset($f['nombre']);
            return $f;
        }, $filas);
    }

    /**
     * Eliminación: el ganador pasa al partido que le corresponde en la ronda siguiente
     * (con null se saca, por ejemplo al corregir un resultado). No se puede cambiar
     * si ese partido ya se jugó.
     */
    public function pasarDeRonda(array $partido, ?int $ganadorId): void
    {
        $siguiente = $this->partidos->buscarEnPosicion(
            (int) $partido['torneo_id'],
            (int) $partido['ronda'] + 1,
            intdiv((int) $partido['orden'], 2)
        );
        if ($siguiente === null) {
            return; // era la final
        }
        if ($siguiente['resultado_local'] !== null) {
            throw new ErrorHttp(409, 'El partido de la ronda siguiente ya tiene resultado: corregí ese primero');
        }
        $lado = (int) $partido['orden'] % 2 === 0 ? 'local_id' : 'visitante_id';
        $this->partidos->ponerEquipo((int) $siguiente['id'], $lado, $ganadorId);
    }

    // Id del campeón, o null si el torneo todavía no terminó
    public function campeon(array $torneo, array $equipos, array $partidos): ?int
    {
        if ($partidos === []) {
            return null;
        }
        if ($torneo['formato'] === 'eliminacion') {
            $final = end($partidos); // ordenados por ronda y orden: la final es el último
            return $final['ganador_id'] !== null ? (int) $final['ganador_id'] : null;
        }
        foreach ($partidos as $p) {
            if ($p['resultado_local'] === null) {
                return null;
            }
        }
        return self::tabla($equipos, $partidos)[0]['equipoId'];
    }

    // En curso o finalizado según si ya hay campeón
    public function actualizarEstado(array $torneo, array $equipos): void
    {
        $partidos = $this->partidos->listarPorTorneo((int) $torneo['id']);
        $estado = $this->campeon($torneo, $equipos, $partidos) !== null ? 'finalizado' : 'en_curso';
        if ($estado !== $torneo['estado']) {
            $this->torneos->cambiarEstado((int) $torneo['id'], $estado);
        }
    }
}
