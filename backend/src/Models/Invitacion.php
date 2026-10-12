<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Código para que un empleado se una a un complejo. Se guarda solo el hash del
 * código: quien lea la base no puede usarlo. Sirve una vez y vence a los 7 días.
 */
final class Invitacion extends Modelo
{
    protected string $tabla = 'invitaciones';

    public const DIAS_VIGENCIA = 7;
    public const MAXIMO_VIGENTES = 5;

    // Sin letras ni números que se confunden al dictarlos (0/O, 1/I/L)
    private const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    // "ABCD-EFGH": 8 caracteres al azar (31^8, unos 850 mil millones de combinaciones)
    public static function generarCodigo(): string
    {
        $codigo = '';
        for ($i = 0; $i < 8; $i++) {
            $codigo .= self::ALFABETO[random_int(0, strlen(self::ALFABETO) - 1)];
        }
        return substr($codigo, 0, 4) . '-' . substr($codigo, 4);
    }

    // Lo que escribe el empleado ("abcd efgh", "ABCD-EFGH") -> hash comparable
    public static function hash(string $codigo): string
    {
        return hash('sha256', preg_replace('/[^A-Z0-9]/', '', strtoupper($codigo)));
    }

    public function crear(int $complejoId, string $codigo): int
    {
        return $this->insertar([
            'complejo_id' => $complejoId,
            'codigo_hash' => self::hash($codigo),
            'vence_en' => date('Y-m-d H:i:s', strtotime('+' . self::DIAS_VIGENCIA . ' days')),
        ]);
    }

    // Sin usar y sin vencer
    public function listarVigentes(int $complejoId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM invitaciones WHERE complejo_id = ? AND usada_por IS NULL AND vence_en > NOW() ORDER BY id'
        );
        $stmt->execute([$complejoId]);
        return $stmt->fetchAll();
    }

    // La invitación vigente con ese código, trabada hasta terminar la transacción (se usa una sola vez)
    public function buscarVigentePorCodigo(string $codigo): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM invitaciones WHERE codigo_hash = ? AND usada_por IS NULL AND vence_en > NOW() FOR UPDATE'
        );
        $stmt->execute([self::hash($codigo)]);
        return $stmt->fetch() ?: null;
    }

    public function buscarConDueno(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT i.*, x.usuario_id FROM invitaciones i JOIN complejos x ON x.id = i.complejo_id WHERE i.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function marcarUsada(int $id, int $usuarioId): void
    {
        $this->actualizar($id, ['usada_por' => $usuarioId]);
    }

    public function borrar(int $id): void
    {
        $this->pdo->prepare('DELETE FROM invitaciones WHERE id = ?')->execute([$id]);
    }

    public function publico(array $invitacion): array
    {
        return ['id' => (int) $invitacion['id'], 'venceEn' => substr($invitacion['vence_en'], 0, 10)];
    }
}
