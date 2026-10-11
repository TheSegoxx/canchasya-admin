<?php

declare(strict_types=1);

/**
 * Funciones comunes a toda la API.
 */

// Responde en JSON con el código HTTP indicado y corta la ejecución
function responder(int $codigo, ?array $datos = null): never
{
    http_response_code($codigo);
    if ($datos !== null) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    exit;
}

// Lee el cuerpo JSON de la petición; si no es JSON válido responde 400
function leerJson(): array
{
    $crudo = file_get_contents('php://input');
    if ($crudo === '' || $crudo === false) {
        return [];
    }
    // Quita el BOM de UTF-8 si algún cliente lo envía al principio del JSON
    $crudo = preg_replace('/^\xEF\xBB\xBF/', '', $crudo);
    $datos = json_decode($crudo, true);
    if (!is_array($datos)) {
        responder(400, ['error' => 'El cuerpo de la petición no es un JSON válido']);
    }
    return $datos;
}

// Cabeceras de seguridad que acompañan a todas las respuestas
function enviarCabecerasSeguridad(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');

    // La app Android no necesita CORS; solo se permiten los orígenes de desarrollo del .env
    $origen = $_SERVER['HTTP_ORIGIN'] ?? '';
    $permitidos = array_filter(array_map('trim', explode(',', $_ENV['CORS_ORIGENES'] ?? '')));
    if ($origen !== '' && in_array($origen, $permitidos, true)) {
        header("Access-Control-Allow-Origin: $origen");
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
    }
}

// Valor de un campo como texto; si mandaron una lista u objeto se toma como vacío
function textoDe(array $datos, string $campo): string
{
    $valor = $datos[$campo] ?? '';
    return is_scalar($valor) ? (string) $valor : '';
}

// Devuelve un texto sin espacios sobrantes o responde 400 si falta o es muy largo
function textoRequerido(array $datos, string $campo, int $maximo, string $nombreVisible): string
{
    $valor = trim(textoDe($datos, $campo));
    if ($valor === '') {
        responder(400, ['error' => "Falta $nombreVisible"]);
    }
    if (mb_strlen($valor) > $maximo) {
        responder(400, ['error' => ucfirst("$nombreVisible no puede superar los $maximo caracteres")]);
    }
    return $valor;
}

// Valida una hora "HH:MM" y la devuelve como "HH:MM:00" (comparable como texto).
// 24:00 solo se acepta como hora de fin (medianoche)
function horaRequerida(array $datos, string $campo, string $nombreVisible, bool $admiteMedianoche = false): string
{
    $valor = textoDe($datos, $campo);
    $valida = preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $valor)
        || ($admiteMedianoche && $valor === '24:00');
    if (!$valida) {
        responder(400, ['error' => "Falta $nombreVisible o no tiene el formato HH:MM"]);
    }
    return "$valor:00";
}

// Valida un importe en pesos (mayor o igual a 0, con hasta 2 decimales)
function precioRequerido(array $datos, string $campo, string $nombreVisible): float
{
    $valor = $datos[$campo] ?? null;
    if (!is_int($valor) && !is_float($valor)) {
        responder(400, ['error' => "Falta $nombreVisible"]);
    }
    if ($valor < 0 || $valor > 99999999) {
        responder(400, ['error' => ucfirst("$nombreVisible no es válido")]);
    }
    return round((float) $valor, 2);
}

// IP de quien hace la petición (para el límite de intentos)
function ipCliente(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
