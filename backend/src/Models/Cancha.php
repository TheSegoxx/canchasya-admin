<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Cancha de pádel o fútbol 5 de un complejo.
 */
final class Cancha extends Modelo
{
    protected string $tabla = 'canchas';

    public const DEPORTES = ['padel', 'futbol5'];
    public const DURACIONES = [60, 90];
    public const ESTADOS = ['libre', 'ocupada'];

    public function listarPorComplejo(int $complejoId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM canchas WHERE complejo_id = ? ORDER BY deporte, nombre');
        $stmt->execute([$complejoId]);
        return $stmt->fetchAll();
    }

    // Busca la cancha junto con el id del dueño, para controlar que sea suya
    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT c.*, x.usuario_id FROM canchas c JOIN complejos x ON x.id = c.complejo_id WHERE c.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    // La comparación de la base no distingue mayúsculas ni tildes ("Pádel 1" = "padel 1")
    public function nombreEnUso(int $complejoId, string $nombre, ?int $exceptoId = null): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM canchas WHERE complejo_id = ? AND nombre = ? AND id <> ?');
        $stmt->execute([$complejoId, $nombre, $exceptoId ?? 0]);
        return (bool) $stmt->fetchColumn();
    }

    public function crear(int $complejoId, array $datos): int
    {
        return $this->insertar(['complejo_id' => $complejoId, ...$this->columnas($datos)]);
    }

    public function editar(int $id, array $datos): void
    {
        $this->actualizar($id, $this->columnas($datos));
    }

    public function cambiarEstado(int $id, string $estado): void
    {
        $this->actualizar($id, ['estado' => $estado]);
    }

    public function cambiarHabilitada(int $id, bool $habilitada): void
    {
        $this->actualizar($id, ['habilitada' => (int) $habilitada]);
    }

    public function publico(array $cancha): array
    {
        return [
            'id' => (int) $cancha['id'],
            'nombre' => $cancha['nombre'],
            'deporte' => $cancha['deporte'],
            'superficie' => $cancha['superficie'],
            'techada' => (bool) $cancha['techada'],
            'duracionMin' => (int) $cancha['duracion_min'],
            'precioBase' => (float) $cancha['precio_base'],
            'estado' => $cancha['estado'],
            'habilitada' => (bool) $cancha['habilitada'],
        ];
    }

    private function columnas(array $datos): array
    {
        return [
            'nombre' => $datos['nombre'],
            'deporte' => $datos['deporte'],
            'superficie' => $datos['superficie'],
            'techada' => (int) $datos['techada'],
            'duracion_min' => $datos['duracionMin'],
            'precio_base' => $datos['precioBase'],
        ];
    }
}
