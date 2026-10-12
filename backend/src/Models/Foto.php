<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Foto del complejo (cancha_id NULL) o de una cancha. El archivo se guarda en
 * public/fotos con un nombre aleatorio y Apache lo sirve directo.
 */
final class Foto extends Modelo
{
    protected string $tabla = 'fotos';

    public const MAXIMO_COMPLEJO = 6;
    public const MAXIMO_CANCHA = 3;

    public static function carpeta(): string
    {
        return dirname(__DIR__, 2) . '/public/fotos';
    }

    // Las del complejo (sin cancha) o las de una cancha, de la más vieja a la más nueva
    public function listar(int $complejoId, ?int $canchaId = null): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM fotos WHERE complejo_id = ? AND cancha_id <=> ? ORDER BY id'
        );
        $stmt->execute([$complejoId, $canchaId]);
        return $stmt->fetchAll();
    }

    // Primera foto de cada cancha del complejo: [canchaId => archivo] (para las tarjetas)
    public function portadasDeCanchas(int $complejoId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT f.cancha_id, f.archivo FROM fotos f
             WHERE f.complejo_id = ? AND f.cancha_id IS NOT NULL
               AND f.id = (SELECT MIN(id) FROM fotos WHERE cancha_id = f.cancha_id)'
        );
        $stmt->execute([$complejoId]);
        return array_column($stmt->fetchAll(), 'archivo', 'cancha_id');
    }

    public function contar(int $complejoId, ?int $canchaId): int
    {
        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM fotos WHERE complejo_id = ? AND cancha_id <=> ?');
        $stmt->execute([$complejoId, $canchaId]);
        return (int) $stmt->fetchColumn();
    }

    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT f.*, x.usuario_id FROM fotos f JOIN complejos x ON x.id = f.complejo_id WHERE f.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function crear(int $complejoId, ?int $canchaId, string $archivo): int
    {
        return $this->insertar(['complejo_id' => $complejoId, 'cancha_id' => $canchaId, 'archivo' => $archivo]);
    }

    public function borrar(int $id): void
    {
        $this->pdo->prepare('DELETE FROM fotos WHERE id = ?')->execute([$id]);
    }

    // La app arma la dirección completa con su propia URL del servidor
    public function publico(array $foto): array
    {
        return ['id' => (int) $foto['id'], 'ruta' => 'fotos/' . $foto['archivo']];
    }
}
