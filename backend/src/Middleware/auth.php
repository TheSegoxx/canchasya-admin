<?php

declare(strict_types=1);

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

/**
 * Exige un JWT válido en el header "Authorization: Bearer <token>"
 * y devuelve el id del dueño logueado. Si no hay token o es inválido, responde 401.
 */
function autenticar(): int
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($header, 'Bearer ')) {
        responder(401, ['error' => 'Falta el token de sesión']);
    }

    try {
        // decode verifica la firma con nuestro secreto y que el token no esté vencido (exp)
        $payload = JWT::decode(substr($header, 7), new Key($_ENV['JWT_SECRET'], 'HS256'));
    } catch (Throwable $e) {
        responder(401, ['error' => 'La sesión no es válida o venció. Iniciá sesión de nuevo.']);
    }

    return (int) $payload->sub;
}

/**
 * Genera el JWT de sesión: id del usuario en "sub", firmado con HS256, válido 7 días.
 */
function generarToken(int $usuarioId): string
{
    $ahora = time();
    $duracion = (int) ($_ENV['JWT_DURACION_SEG'] ?? 604800);

    return JWT::encode([
        'sub' => $usuarioId,
        'iat' => $ahora,
        'exp' => $ahora + $duracion,
    ], $_ENV['JWT_SECRET'], 'HS256');
}
