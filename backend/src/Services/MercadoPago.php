<?php

declare(strict_types=1);

namespace App\Services;

use App\ErrorHttp;

/**
 * Cliente mínimo de la API de Mercado Pago (Checkout Pro).
 * El Access Token va en el .env (MP_ACCESS_TOKEN) y nunca sale del servidor.
 * Con las credenciales de prueba (empiezan con APP_USR-, igual que las reales) no se mueve plata real.
 */
final class MercadoPago
{
    private const API = 'https://api.mercadopago.com';
    private const TIEMPO_ESPERA_SEG = 15;

    private string $token;

    public function __construct()
    {
        $this->token = trim($_ENV['MP_ACCESS_TOKEN'] ?? '');
        if ($this->token === '') {
            throw new ErrorHttp(503, 'Mercado Pago todavía no está configurado en el servidor (falta MP_ACCESS_TOKEN en el .env).');
        }
    }

    /**
     * Crea un link de pago (preferencia) por un monto, que vence en $vence ("Y-m-d H:i:s").
     * $referencia vuelve en los pagos: sirve para encontrarlos después.
     *
     * @return array{id: string, url: string}
     */
    public function crearLink(string $titulo, float $monto, string $referencia, string $vence): array
    {
        $respuesta = $this->pedir('POST', '/checkout/preferences', [
            'items' => [[
                'title' => mb_substr($titulo, 0, 250),
                'quantity' => 1,
                'unit_price' => $monto,
                'currency_id' => 'ARS',
            ]],
            'external_reference' => $referencia,
            'expires' => true,
            'expiration_date_from' => date('c'),
            'expiration_date_to' => date('c', strtotime($vence)),
            // Solo pagos que se acreditan al instante (sin efectivo en Rapipago/Pago Fácil)
            'payment_methods' => ['excluded_payment_types' => [['id' => 'ticket'], ['id' => 'atm']]],
        ]);
        if (!isset($respuesta['id'], $respuesta['init_point'])) {
            throw new ErrorHttp(502, 'Mercado Pago no devolvió el link de pago');
        }
        return ['id' => (string) $respuesta['id'], 'url' => (string) $respuesta['init_point']];
    }

    // Vence el link ya mismo (al anularlo), así nadie lo puede pagar después
    public function vencerLink(string $preferenciaId): void
    {
        $this->pedir('PUT', '/checkout/preferences/' . rawurlencode($preferenciaId), [
            'expires' => true,
            'expiration_date_to' => date('c'),
        ]);
    }

    /**
     * Pago aprobado con esa referencia, o null si todavía no pagaron.
     *
     * @return array{id: string, monto: float}|null
     */
    public function pagoAprobado(string $referencia): ?array
    {
        $respuesta = $this->pedir('GET', '/v1/payments/search?' . http_build_query([
            'external_reference' => $referencia,
            'sort' => 'date_created',
            'criteria' => 'desc',
        ]));
        foreach ($respuesta['results'] ?? [] as $pago) {
            if (($pago['status'] ?? '') === 'approved') {
                return ['id' => (string) $pago['id'], 'monto' => (float) $pago['transaction_amount']];
            }
        }
        return null;
    }

    private function pedir(string $metodo, string $ruta, ?array $cuerpo = null): array
    {
        $curl = curl_init(self::API . $ruta);
        $encabezados = ['Authorization: Bearer ' . $this->token, 'Accept: application/json'];
        if ($cuerpo !== null) {
            $encabezados[] = 'Content-Type: application/json';
            // Si el pedido se repite por un corte, Mercado Pago no crea dos links
            $encabezados[] = 'X-Idempotency-Key: ' . bin2hex(random_bytes(16));
            curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($cuerpo, JSON_UNESCAPED_UNICODE));
        }
        curl_setopt_array($curl, [
            CURLOPT_CUSTOMREQUEST => $metodo,
            CURLOPT_HTTPHEADER => $encabezados,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => self::TIEMPO_ESPERA_SEG,
        ]);
        $texto = curl_exec($curl);
        $codigo = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $falla = curl_error($curl);
        curl_close($curl);

        if ($texto === false) {
            error_log("[CanchasYa API] Mercado Pago no respondió: $falla");
            throw new ErrorHttp(502, 'No se pudo conectar con Mercado Pago. Probá de nuevo en un rato.');
        }
        $datos = json_decode($texto, true) ?? [];
        if ($codigo === 401 || $codigo === 403) {
            throw new ErrorHttp(502, 'Mercado Pago rechazó las credenciales: revisá MP_ACCESS_TOKEN en el .env');
        }
        if ($codigo >= 400) {
            error_log("[CanchasYa API] Mercado Pago $codigo: $texto");
            throw new ErrorHttp(502, 'Mercado Pago devolvió un error: ' . ($datos['message'] ?? "código $codigo"));
        }
        return $datos;
    }
}
