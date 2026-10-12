<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Turno que un cliente tiene todas las semanas. No se guardan los turnos de
 * todas las fechas futuras: el de cada fecha se crea al consultar ese día
 * (ver AgendaService::materializarFijos).
 */
final class TurnoFijo extends Modelo
{
    protected string $tabla = 'turnos_fijos';

    // Fijos vigentes en esa fecha que todavía no tienen su turno creado
    public function pendientes(int $complejoId, string $fecha, ?int $canchaId = null): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT f.* FROM turnos_fijos f
             JOIN canchas c ON c.id = f.cancha_id
             WHERE c.complejo_id = ? AND c.habilitada = 1 AND (? IS NULL OR c.id = ?)
               AND f.dia_semana = ? AND f.fecha_desde <= ? AND (f.fecha_hasta IS NULL OR f.fecha_hasta >= ?)
               AND NOT EXISTS (SELECT 1 FROM turnos t WHERE t.turno_fijo_id = f.id AND t.fecha = ?)
             ORDER BY f.cancha_id, f.hora_inicio'
        );
        $stmt->execute([$complejoId, $canchaId, $canchaId, diaDeLaSemana($fecha), $fecha, $fecha, $fecha]);
        return $stmt->fetchAll();
    }

    // Otro fijo de la misma cancha, día y horario que siga vigente desde esa fecha
    public function enConflicto(int $canchaId, int $diaSemana, string $inicio, string $fin, string $desde): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT f.*, cl.nombre AS cliente_nombre FROM turnos_fijos f
             JOIN clientes cl ON cl.id = f.cliente_id
             WHERE f.cancha_id = ? AND f.dia_semana = ? AND f.hora_inicio < ? AND f.hora_fin > ?
               AND (f.fecha_hasta IS NULL OR f.fecha_hasta >= ?)
             LIMIT 1'
        );
        $stmt->execute([$canchaId, $diaSemana, $fin, $inicio, $desde]);
        return $stmt->fetch() ?: null;
    }

    // Los que siguen vigentes (sin fin o con fin desde hoy), con cliente y cancha
    public function listarVigentes(int $complejoId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT f.*, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono, c.nombre AS cancha_nombre
             FROM turnos_fijos f
             JOIN canchas c ON c.id = f.cancha_id
             JOIN clientes cl ON cl.id = f.cliente_id
             WHERE c.complejo_id = ? AND (f.fecha_hasta IS NULL OR f.fecha_hasta >= ?)
             ORDER BY f.dia_semana, f.hora_inicio, c.nombre'
        );
        $stmt->execute([$complejoId, hoy()]);
        return $stmt->fetchAll();
    }

    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT f.*, x.usuario_id FROM turnos_fijos f
             JOIN canchas c ON c.id = f.cancha_id
             JOIN complejos x ON x.id = c.complejo_id
             WHERE f.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    /** @param array{canchaId: int, clienteId: int, fecha: string, horaInicio: string, horaFin: string, precio: ?float} $datos */
    public function crear(array $datos): int
    {
        return $this->insertar([
            'cancha_id' => $datos['canchaId'],
            'cliente_id' => $datos['clienteId'],
            'dia_semana' => diaDeLaSemana($datos['fecha']),
            'hora_inicio' => $datos['horaInicio'],
            'hora_fin' => $datos['horaFin'],
            'precio' => $datos['precio'],
            'fecha_desde' => $datos['fecha'],
        ]);
    }

    // El último día en que el fijo todavía se juega
    public function terminar(int $id, string $fechaHasta): void
    {
        $this->actualizar($id, ['fecha_hasta' => $fechaHasta]);
    }

    public function publico(array $fijo): array
    {
        return [
            'id' => (int) $fijo['id'],
            'canchaId' => (int) $fijo['cancha_id'],
            'canchaNombre' => $fijo['cancha_nombre'] ?? null,
            'diaSemana' => (int) $fijo['dia_semana'],
            'horaInicio' => horaCorta($fijo['hora_inicio']),
            'horaFin' => horaCorta($fijo['hora_fin']),
            'precio' => $fijo['precio'] !== null ? (float) $fijo['precio'] : null,
            'fechaDesde' => $fijo['fecha_desde'],
            'fechaHasta' => $fijo['fecha_hasta'],
            'cliente' => isset($fijo['cliente_nombre']) ? [
                'id' => (int) $fijo['cliente_id'],
                'nombre' => $fijo['cliente_nombre'],
                'telefono' => $fijo['cliente_telefono'],
            ] : null,
        ];
    }
}
