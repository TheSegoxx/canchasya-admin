<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Complejo deportivo. Cada dueño tiene uno solo (UNIQUE usuario_id).
 */
final class Complejo extends Modelo
{
    protected string $tabla = 'complejos';

    // Servicios que se pueden marcar en la app
    public const SERVICIOS = ['vestuarios', 'duchas', 'buffet', 'estacionamiento', 'wifi', 'parrilla'];

    public function buscarPorUsuario(int $usuarioId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM complejos WHERE usuario_id = ?');
        $stmt->execute([$usuarioId]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Crea el complejo del dueño o actualiza el que ya tiene.
     * Devuelve true si lo creó.
     */
    public function guardar(int $usuarioId, array $datos): bool
    {
        $columnas = [
            'nombre' => $datos['nombre'],
            'direccion' => $datos['direccion'],
            'ciudad' => $datos['ciudad'],
            'latitud' => $datos['latitud'],
            'longitud' => $datos['longitud'],
            'telefono' => $datos['telefono'],
            'hora_apertura' => $datos['horaApertura'],
            'hora_cierre' => $datos['horaCierre'],
            'servicios' => json_encode($datos['servicios']),
            'visible' => $datos['visible'] ? 1 : 0,
        ];

        $existente = $this->buscarPorUsuario($usuarioId);
        if ($existente === null) {
            $this->insertar(['usuario_id' => $usuarioId, ...$columnas]);
            return true;
        }
        $this->actualizar((int) $existente['id'], $columnas);
        return false;
    }

    // Formato que recibe la app (horas como "HH:MM")
    public function publico(array $complejo): array
    {
        return [
            'id' => (int) $complejo['id'],
            'nombre' => $complejo['nombre'],
            'direccion' => $complejo['direccion'],
            'ciudad' => $complejo['ciudad'],
            'ubicacion' => self::ubicacion($complejo),
            'telefono' => $complejo['telefono'],
            'horaApertura' => substr($complejo['hora_apertura'], 0, 5),
            'horaCierre' => substr($complejo['hora_cierre'], 0, 5),
            'servicios' => json_decode($complejo['servicios'] ?? '[]', true) ?? [],
            // Si aparece en la búsqueda de los jugadores
            'visible' => (bool) $complejo['visible'],
            'reservas' => self::reglasReservas($complejo),
        ];
    }

    /**
     * Cómo toma reservas desde la app: si las acepta, la seña (% del total, 0 = sin seña),
     * los minutos para pagarla, hasta cuántos días antes se reserva y hasta cuántas horas
     * antes el jugador puede cancelar.
     */
    public static function reglasReservas(array $complejo): array
    {
        return [
            'aceptaReservas' => (bool) $complejo['reservas_online'],
            'senaPorcentaje' => (int) $complejo['sena_porcentaje'],
            'senaMinutos' => (int) $complejo['sena_minutos'],
            'reservaDias' => (int) $complejo['reserva_dias'],
            'cancelacionHoras' => (int) $complejo['cancelacion_horas'],
        ];
    }

    /** @param array{aceptaReservas: bool, senaPorcentaje: int, senaMinutos: int, reservaDias: int, cancelacionHoras: int} $reglas */
    public function guardarReglasReservas(int $id, array $reglas): void
    {
        $this->actualizar($id, [
            'reservas_online' => $reglas['aceptaReservas'] ? 1 : 0,
            'sena_porcentaje' => $reglas['senaPorcentaje'],
            'sena_minutos' => $reglas['senaMinutos'],
            'reserva_dias' => $reglas['reservaDias'],
            'cancelacion_horas' => $reglas['cancelacionHoras'],
        ]);
    }

    /**
     * {latitud, longitud} o null si no se cargó. Recibe una fila con las columnas
     * latitud y longitud (o complejo_latitud y complejo_longitud, como la arma Turno).
     */
    public static function ubicacion(array $fila, string $prefijo = ''): ?array
    {
        $latitud = $fila[$prefijo . 'latitud'] ?? null;
        $longitud = $fila[$prefijo . 'longitud'] ?? null;
        return $latitud !== null && $longitud !== null
            ? ['latitud' => (float) $latitud, 'longitud' => (float) $longitud]
            : null;
    }
}
