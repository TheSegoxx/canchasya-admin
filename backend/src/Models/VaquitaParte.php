<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Parte de la vaquita de una reserva: lo que pone cada amigo, con su link de Mercado Pago.
 * El estado sale del link: pagada, pendiente o vencida.
 */
final class VaquitaParte extends Modelo
{
    protected string $tabla = 'vaquita_partes';

    public const MINIMO_PARTES = 2;
    public const MAXIMO_PARTES = 10;

    /**
     * Divide $saldo entre $partes en pesos enteros. Los centavos y los pesos que sobran
     * van a la primera parte (la del organizador). Ej.: 81000 entre 7 = 11574 + 6 × 11571.
     *
     * @return list<float>
     */
    public static function dividir(float $saldo, int $partes): array
    {
        $centavos = (int) round($saldo * 100);
        $cadaUno = intdiv(intdiv($centavos, $partes), 100) * 100;
        $primera = $centavos - $cadaUno * ($partes - 1);
        return [$primera / 100, ...array_fill(0, $partes - 1, $cadaUno / 100)];
    }

    // Las partes vigentes (sin las de vaquitas deshechas), con el estado de su link
    public function listarDelTurno(int $turnoId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT v.*, l.estado AS link_estado, l.url AS link_url, l.vence_en AS link_vence_en
             FROM vaquita_partes v LEFT JOIN links_pago l ON l.id = v.link_id
             WHERE v.turno_id = ? AND v.anulada = 0
             ORDER BY v.id'
        );
        $stmt->execute([$turnoId]);
        return $stmt->fetchAll();
    }

    public function crear(int $turnoId, string $nombre, float $monto, bool $esOrganizador): int
    {
        return $this->insertar([
            'turno_id' => $turnoId,
            'nombre' => $nombre,
            'monto' => $monto,
            'es_organizador' => $esOrganizador ? 1 : 0,
        ]);
    }

    public function asignarLink(int $id, int $linkId): void
    {
        $this->actualizar($id, ['link_id' => $linkId]);
    }

    /**
     * Deshace la vaquita: las partes que no se pagaron quedan anuladas.
     * Devuelve los ids de sus links pendientes (para anularlos también en Mercado Pago).
     *
     * @return list<int>
     */
    public function anularSinPagar(int $turnoId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT v.id, v.link_id, l.estado FROM vaquita_partes v LEFT JOIN links_pago l ON l.id = v.link_id
             WHERE v.turno_id = ? AND v.anulada = 0 AND (l.id IS NULL OR l.estado <> 'pagado')"
        );
        $stmt->execute([$turnoId]);
        $links = [];
        foreach ($stmt->fetchAll() as $parte) {
            $this->actualizar((int) $parte['id'], ['anulada' => 1]);
            if ($parte['estado'] === 'pendiente') {
                $links[] = (int) $parte['link_id'];
            }
        }
        return $links;
    }

    // La parte que se paga con ese link (para avisar quién pagó)
    public function buscarPorLink(int $linkId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM vaquita_partes WHERE link_id = ?');
        $stmt->execute([$linkId]);
        return $stmt->fetch() ?: null;
    }

    public static function estado(array $parte): string
    {
        return match ($parte['link_estado'] ?? null) {
            'pagado' => 'pagada',
            'pendiente' => $parte['link_vence_en'] > date('Y-m-d H:i:s') ? 'pendiente' : 'vencida',
            default => 'vencida',
        };
    }

    public function publico(array $parte): array
    {
        $estado = self::estado($parte);
        return [
            'id' => (int) $parte['id'],
            'nombre' => $parte['nombre'],
            'monto' => (float) $parte['monto'],
            'esOrganizador' => (bool) $parte['es_organizador'],
            'estado' => $estado,
            // El link solo mientras se puede pagar
            'url' => $estado === 'pendiente' ? $parte['link_url'] : null,
        ];
    }
}
