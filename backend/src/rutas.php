<?php

declare(strict_types=1);

/**
 * Tabla de rutas de la API. Base: http://<servidor>/canchasya/api
 *
 * @var App\Router $router
 */

use App\Controllers\AuthController;
use App\Controllers\CanchaController;
use App\Controllers\ComplejoController;

// Prueba de conexión desde la app
$router->agregar('GET', '/salud', fn () => responder(200, ['ok' => true, 'api' => 'CanchasYa Admin', 'hora' => date('c')]));

// Autenticación
$router->agregar('POST', '/auth/register', fn () => (new AuthController())->registrar());
$router->agregar('POST', '/auth/login', fn () => (new AuthController())->login());
$router->agregar('POST', '/auth/google', fn () => (new AuthController())->google());
$router->agregar('GET', '/auth/yo', fn () => (new AuthController())->yo());

// Complejo del dueño
$router->agregar('GET', '/complejo', fn () => (new ComplejoController())->obtener());
$router->agregar('PUT', '/complejo', fn () => (new ComplejoController())->guardar());

// Canchas y precios por franja horaria
$router->agregar('GET', '/canchas', fn () => (new CanchaController())->listar());
$router->agregar('POST', '/canchas', fn () => (new CanchaController())->crear());
$router->agregar('GET', '/canchas/:id', fn (array $p) => (new CanchaController())->obtener($p['id']));
$router->agregar('PUT', '/canchas/:id', fn (array $p) => (new CanchaController())->editar($p['id']));
$router->agregar('PATCH', '/canchas/:id/estado', fn (array $p) => (new CanchaController())->cambiarEstado($p['id']));
$router->agregar('PATCH', '/canchas/:id/habilitada', fn (array $p) => (new CanchaController())->cambiarHabilitada($p['id']));
$router->agregar('GET', '/canchas/:id/franjas', fn (array $p) => (new CanchaController())->listarFranjas($p['id']));
$router->agregar('POST', '/canchas/:id/franjas', fn (array $p) => (new CanchaController())->crearFranja($p['id']));
$router->agregar('DELETE', '/franjas/:id', fn (array $p) => (new CanchaController())->borrarFranja($p['id']));
