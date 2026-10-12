<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Armado del fixture (sin base de datos: recibe ids de equipos y devuelve los cruces).
 */
final class Fixture
{
    /**
     * Liga todos contra todos por el método del círculo: un equipo queda fijo y el
     * resto gira una posición por fecha. Con cantidad impar, cada fecha uno queda libre.
     *
     * @param list<int> $equipos
     * @return list<array{ronda: int, orden: int, local: int, visitante: int}>
     */
    public static function liga(array $equipos): array
    {
        if (count($equipos) % 2 === 1) {
            $equipos[] = null; // "libre"
        }
        $n = count($equipos);
        $partidos = [];
        for ($r = 0; $r < $n - 1; $r++) {
            $orden = 0;
            for ($i = 0; $i < $n / 2; $i++) {
                $a = $equipos[$i];
                $b = $equipos[$n - 1 - $i];
                if ($a === null || $b === null) {
                    continue;
                }
                // Localías parejas: el equipo fijo alterna fecha por fecha; los demás son
                // locales en la primera mitad de la ronda y visitantes en la otra
                [$local, $visitante] = $i > 0 || $r % 2 === 0 ? [$a, $b] : [$b, $a];
                $partidos[] = ['ronda' => $r + 1, 'orden' => $orden++, 'local' => $local, 'visitante' => $visitante];
            }
            $ultimo = array_pop($equipos);
            array_splice($equipos, 1, 0, [$ultimo]);
        }
        return $partidos;
    }

    /**
     * Posiciones de los cabezas de serie en un cuadro de $tamano (potencia de 2),
     * para que el 1 y el 2 solo puedan cruzarse en la final: 8 -> [1, 8, 4, 5, 2, 7, 3, 6]
     *
     * @return list<int>
     */
    public static function posiciones(int $tamano): array
    {
        $posiciones = [1];
        while (count($posiciones) < $tamano) {
            $suma = count($posiciones) * 2 + 1;
            $siguientes = [];
            foreach ($posiciones as $p) {
                $siguientes[] = $p;
                $siguientes[] = $suma - $p;
            }
            $posiciones = $siguientes;
        }
        return $posiciones;
    }

    /**
     * Eliminación directa: el cuadro se completa hasta la potencia de 2 siguiente y
     * los lugares que sobran son "libres" (pasan directo). Los libres siempre le tocan
     * a los primeros sorteados y nunca se enfrentan dos libres entre sí.
     *
     * @param list<int> $equipos
     * @return array{rondas: int, primera: list<array{orden: int, local: ?int, visitante: ?int}>}
     */
    public static function eliminacion(array $equipos): array
    {
        $tamano = 2;
        $rondas = 1;
        while ($tamano < count($equipos)) {
            $tamano *= 2;
            $rondas++;
        }
        $posiciones = self::posiciones($tamano);
        $primera = [];
        for ($i = 0; $i < $tamano / 2; $i++) {
            $primera[] = [
                'orden' => $i,
                'local' => $equipos[$posiciones[2 * $i] - 1] ?? null,
                'visitante' => $equipos[$posiciones[2 * $i + 1] - 1] ?? null,
            ];
        }
        return ['rondas' => $rondas, 'primera' => $primera];
    }
}
