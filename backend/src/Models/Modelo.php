<?php

declare(strict_types=1);

namespace App\Models;

use PDO;

/**
 * Base de todos los modelos: operaciones comunes sobre una tabla.
 * Los nombres de columnas vienen siempre del código, nunca del usuario;
 * los valores van como parámetros de una consulta preparada.
 */
abstract class Modelo
{
    protected string $tabla;

    public function __construct(protected PDO $pdo)
    {
    }

    public function buscarPorId(int $id): ?array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM {$this->tabla} WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    protected function insertar(array $datos): int
    {
        $columnas = implode(', ', array_keys($datos));
        $marcas = implode(', ', array_fill(0, count($datos), '?'));
        $stmt = $this->pdo->prepare("INSERT INTO {$this->tabla} ($columnas) VALUES ($marcas)");
        $stmt->execute(array_values($datos));
        return (int) $this->pdo->lastInsertId();
    }

    protected function actualizar(int $id, array $datos): void
    {
        $asignaciones = implode(', ', array_map(fn (string $c) => "$c = ?", array_keys($datos)));
        $stmt = $this->pdo->prepare("UPDATE {$this->tabla} SET $asignaciones WHERE id = ?");
        $stmt->execute([...array_values($datos), $id]);
    }
}
