<?php

declare(strict_types=1);

/**
 * Punto de entrada de la API de Canchero's.
 * Apache envía acá todas las peticiones (ver .htaccess en la raíz del backend).
 */

use App\Router;
use Dotenv\Dotenv;

$raiz = dirname(__DIR__);
require $raiz . '/vendor/autoload.php';

// Configuración desde .env (credenciales y secretos, nunca en el código)
$dotenv = Dotenv::createImmutable($raiz);
$dotenv->load();
$dotenv->required(['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET', 'GOOGLE_WEB_CLIENT_ID'])->notEmpty();

ini_set('display_errors', '0');
date_default_timezone_set('America/Argentina/Buenos_Aires');

// Cualquier error no previsto: se registra en el log de Apache y el cliente recibe un mensaje genérico
set_exception_handler(function (Throwable $e): void {
    error_log('[Canchero API] ' . $e);
    $respuesta = ['error' => 'Error interno del servidor'];
    if (($_ENV['APP_ENV'] ?? '') === 'desarrollo') {
        $respuesta['detalle'] = $e->getMessage();
    }
    responder(500, $respuesta);
});

enviarCabecerasSeguridad();

// Peticiones de verificación CORS (solo navegadores)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    responder(204);
}

$router = new Router();
require $raiz . '/src/rutas.php';
$router->despachar($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'] ?? '/');
