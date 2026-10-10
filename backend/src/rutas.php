<?php

declare(strict_types=1);

/**
 * Tabla de rutas de la API. Base: http://<servidor>/canchero/api
 *
 * @var App\Router $router
 */

use App\Controllers\AuthController;
use App\Controllers\ComplejoController;

// Prueba de conexión desde la app
$router->agregar('GET', '/salud', fn () => responder(200, ['ok' => true, 'api' => "Canchero's", 'hora' => date('c')]));

// Autenticación
$router->agregar('POST', '/auth/register', fn () => (new AuthController())->registrar());
$router->agregar('POST', '/auth/login', fn () => (new AuthController())->login());
$router->agregar('POST', '/auth/google', fn () => (new AuthController())->google());
$router->agregar('GET', '/auth/yo', fn () => (new AuthController())->yo());

// Complejo del dueño
$router->agregar('GET', '/complejo', fn () => (new ComplejoController())->obtener());
$router->agregar('PUT', '/complejo', fn () => (new ComplejoController())->guardar());
