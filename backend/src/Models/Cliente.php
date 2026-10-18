<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Cliente del complejo (no usa la app). El teléfono se guarda normalizado
 * y es único por complejo: así no se duplica la misma persona.
 */
final class Cliente extends Modelo
{
    protected string $tabla = 'clientes';

    public function buscarPorTelefono(int $complejoId, string $telefono): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM clientes WHERE complejo_id = ? AND telefono = ?');
        $stmt->execute([$complejoId, $telefono]);
        return $stmt->fetch() ?: null;
    }

    // Por parte del nombre o del teléfono; sin texto devuelve los primeros por nombre
    public function buscar(int $complejoId, string $texto, int $limite = 30): array
    {
        $parecido = '%' . addcslashes($texto, '%_\\') . '%';
        $cifras = preg_replace('/\D/', '', $texto);
        $stmt = $this->pdo->prepare(
            "SELECT * FROM clientes
             WHERE complejo_id = ? AND (nombre LIKE ? OR (? <> '' AND telefono LIKE ?))
             ORDER BY nombre
             LIMIT $limite"
        );
        $stmt->execute([$complejoId, $parecido, $cifras, "%$cifras%"]);
        return $stmt->fetchAll();
    }

    // Busca el cliente junto con el id del dueño del complejo
    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT cl.*, x.usuario_id FROM clientes cl JOIN complejos x ON x.id = cl.complejo_id WHERE cl.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Id del cliente con ese teléfono en el complejo; si no hay, lo crea (no se duplica la persona).
     * Si otro pedido lo creó en ese mismo instante (teléfono único), usa ese.
     */
    public function obtenerOCrear(int $complejoId, string $nombre, string $telefono): int
    {
        $existente = $this->buscarPorTelefono($complejoId, $telefono);
        if ($existente !== null) {
            return (int) $existente['id'];
        }
        try {
            return $this->crear($complejoId, $nombre, $telefono);
        } catch (\PDOException $e) {
            $otro = $e->getCode() === '23000' ? $this->buscarPorTelefono($complejoId, $telefono) : null;
            if ($otro === null) {
                throw $e;
            }
            return (int) $otro['id'];
        }
    }

    public function crear(int $complejoId, string $nombre, string $telefono): int
    {
        return $this->insertar(['complejo_id' => $complejoId, 'nombre' => $nombre, 'telefono' => $telefono]);
    }

    public function editar(int $id, string $nombre, string $telefono): void
    {
        $this->actualizar($id, ['nombre' => $nombre, 'telefono' => $telefono]);
    }

    public function publico(array $cliente): array
    {
        return [
            'id' => (int) $cliente['id'],
            'nombre' => $cliente['nombre'],
            'telefono' => $cliente['telefono'],
        ];
    }
}
