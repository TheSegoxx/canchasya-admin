<?php

declare(strict_types=1);

/**
 * Tabla de rutas de la API. Base: http://<servidor>/canchasya/api
 *
 * @var App\Router $router
 */

use App\Controllers\AgendaController;
use App\Controllers\AuthController;
use App\Controllers\BloqueoController;
use App\Controllers\CanchaController;
use App\Controllers\ClienteController;
use App\Controllers\CobroController;
use App\Controllers\ComplejoController;
use App\Controllers\DashboardController;
use App\Controllers\DispositivoController;
use App\Controllers\EmpleadoController;
use App\Controllers\ExplorarController;
use App\Controllers\FotoController;
use App\Controllers\JugadorController;
use App\Controllers\LinkPagoController;
use App\Controllers\ProductoController;
use App\Controllers\ReservaController;
use App\Controllers\TorneoController;
use App\Controllers\TurnoController;

// Prueba de conexión desde la app
$router->agregar('GET', '/salud', fn () => responder(200, ['ok' => true, 'api' => 'CanchasYa Admin', 'hora' => date('c')]));

// Autenticación
$router->agregar('POST', '/auth/register', fn () => (new AuthController())->registrar());
$router->agregar('POST', '/auth/login', fn () => (new AuthController())->login());
$router->agregar('POST', '/auth/google', fn () => (new AuthController())->google());
$router->agregar('POST', '/auth/recuperar', fn () => (new AuthController())->recuperar());
$router->agregar('POST', '/auth/restablecer', fn () => (new AuthController())->restablecer());
$router->agregar('GET', '/auth/yo', fn () => (new AuthController())->yo());
$router->agregar('PUT', '/auth/perfil', fn () => (new AuthController())->guardarPerfil());

// Notificaciones push: el celular registra su token de Firebase (y lo da de baja al cerrar sesión)
$router->agregar('POST', '/dispositivos', fn () => (new DispositivoController())->registrar());
$router->agregar('POST', '/dispositivos/baja', fn () => (new DispositivoController())->quitar());

// Jugadores: buscar complejos, ver su ficha y guardar favoritos
$router->agregar('GET', '/complejos', fn () => (new ExplorarController())->listar());
$router->agregar('GET', '/complejos/:id', fn (array $p) => (new ExplorarController())->obtener($p['id']));
$router->agregar('PUT', '/complejos/:id/favorito', fn (array $p) => (new ExplorarController())->agregarFavorito($p['id']));
$router->agregar('DELETE', '/complejos/:id/favorito', fn (array $p) => (new ExplorarController())->quitarFavorito($p['id']));
$router->agregar('GET', '/complejos/:id/disponibilidad', fn (array $p) => (new ReservaController())->disponibilidad($p['id']));
$router->agregar('GET', '/complejos/:id/clima', fn (array $p) => (new ExplorarController())->clima($p['id']));

// Reservas del jugador
$router->agregar('POST', '/reservas', fn () => (new ReservaController())->crear());
$router->agregar('GET', '/reservas', fn () => (new ReservaController())->listar());
$router->agregar('GET', '/reservas/:id', fn (array $p) => (new ReservaController())->obtener($p['id']));
$router->agregar('POST', '/reservas/:id/pago', fn (array $p) => (new ReservaController())->pagar($p['id']));
$router->agregar('POST', '/reservas/:id/verificar-pago', fn (array $p) => (new ReservaController())->verificarPago($p['id']));
$router->agregar('POST', '/reservas/:id/cancelar', fn (array $p) => (new ReservaController())->cancelar($p['id']));
$router->agregar('POST', '/reservas/:id/vaquita', fn (array $p) => (new ReservaController())->armarVaquita($p['id']));
$router->agregar('DELETE', '/reservas/:id/vaquita', fn (array $p) => (new ReservaController())->deshacerVaquita($p['id']));
$router->agregar('PUT', '/reservas/:id/me-falta-uno', fn (array $p) => (new ReservaController())->publicarMeFaltaUno($p['id']));
$router->agregar('DELETE', '/reservas/:id/me-falta-uno', fn (array $p) => (new ReservaController())->cerrarMeFaltaUno($p['id']));

// Lista de espera, partidos que buscan jugadores ("me falta uno") y fidelidad
$router->agregar('GET', '/esperas', fn () => (new JugadorController())->listarEsperas());
$router->agregar('POST', '/esperas', fn () => (new JugadorController())->crearEspera());
$router->agregar('DELETE', '/esperas/:id', fn (array $p) => (new JugadorController())->borrarEspera($p['id']));
$router->agregar('GET', '/partidos', fn () => (new JugadorController())->listarPartidos());
$router->agregar('POST', '/partidos/:id/jugadores', fn (array $p) => (new JugadorController())->sumarme($p['id']));
$router->agregar('DELETE', '/partidos/:id/jugadores', fn (array $p) => (new JugadorController())->bajarme($p['id']));
$router->agregar('GET', '/fidelidad', fn () => (new JugadorController())->tarjetas());

// Complejo del dueño
$router->agregar('GET', '/complejo', fn () => (new ComplejoController())->obtener());
$router->agregar('PUT', '/complejo', fn () => (new ComplejoController())->guardar());
$router->agregar('GET', '/complejo/buscar-ubicacion', fn () => (new ComplejoController())->buscarUbicacion());
$router->agregar('PUT', '/complejo/reservas', fn () => (new ComplejoController())->guardarReglasReservas());

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

// Agenda: el día completo, turnos, turnos fijos, clientes y bloqueos
$router->agregar('GET', '/agenda', fn () => (new AgendaController())->dia());
$router->agregar('POST', '/turnos', fn () => (new TurnoController())->crear());
$router->agregar('GET', '/turnos/:id', fn (array $p) => (new TurnoController())->obtener($p['id']));
$router->agregar('PATCH', '/turnos/:id/estado', fn (array $p) => (new TurnoController())->cambiarEstado($p['id']));
$router->agregar('GET', '/turnos-fijos', fn () => (new TurnoController())->listarFijos());
$router->agregar('PATCH', '/turnos-fijos/:id/baja', fn (array $p) => (new TurnoController())->darDeBajaFijo($p['id']));
$router->agregar('GET', '/clientes', fn () => (new ClienteController())->listar());
$router->agregar('PUT', '/clientes/:id', fn (array $p) => (new ClienteController())->editar($p['id']));
$router->agregar('POST', '/bloqueos', fn () => (new BloqueoController())->crear());
$router->agregar('DELETE', '/bloqueos/:id', fn (array $p) => (new BloqueoController())->borrar($p['id']));

// Cobros: pagos y extras de cada turno, catálogo de productos y caja del día
$router->agregar('POST', '/turnos/:id/pagos', fn (array $p) => (new CobroController())->registrarPago($p['id']));
$router->agregar('DELETE', '/pagos/:id', fn (array $p) => (new CobroController())->borrarPago($p['id']));
$router->agregar('POST', '/turnos/:id/consumos', fn (array $p) => (new CobroController())->agregarConsumo($p['id']));
$router->agregar('DELETE', '/consumos/:id', fn (array $p) => (new CobroController())->borrarConsumo($p['id']));
$router->agregar('GET', '/caja', fn () => (new CobroController())->caja());
$router->agregar('GET', '/productos', fn () => (new ProductoController())->listar());
$router->agregar('POST', '/productos', fn () => (new ProductoController())->crear());
$router->agregar('PUT', '/productos/:id', fn (array $p) => (new ProductoController())->editar($p['id']));

// Dashboard: ingresos, egresos y balance de un período; gastos y otros ingresos cargados a mano
$router->agregar('GET', '/dashboard', fn () => (new DashboardController())->resumen());
$router->agregar('GET', '/movimientos', fn () => (new DashboardController())->listar());
$router->agregar('POST', '/movimientos', fn () => (new DashboardController())->crear());
$router->agregar('DELETE', '/movimientos/:id', fn (array $p) => (new DashboardController())->borrar($p['id']));

// Fotos del complejo y de las canchas (los archivos los sirve Apache desde /fotos)
$router->agregar('POST', '/fotos', fn () => (new FotoController())->subir());
$router->agregar('DELETE', '/fotos/:id', fn (array $p) => (new FotoController())->borrar($p['id']));

// Empleados: invitaciones con código y quitar el acceso (solo el dueño); unirse a un complejo
$router->agregar('GET', '/empleados', fn () => (new EmpleadoController())->listar());
$router->agregar('DELETE', '/empleados/:id', fn (array $p) => (new EmpleadoController())->quitar($p['id']));
$router->agregar('POST', '/invitaciones', fn () => (new EmpleadoController())->invitar());
$router->agregar('POST', '/invitaciones/aceptar', fn () => (new EmpleadoController())->aceptar());
$router->agregar('DELETE', '/invitaciones/:id', fn (array $p) => (new EmpleadoController())->anularInvitacion($p['id']));

// Torneos y ligas: equipos, sorteo del fixture, resultados y programación en la agenda
$router->agregar('GET', '/torneos', fn () => (new TorneoController())->listar());
$router->agregar('POST', '/torneos', fn () => (new TorneoController())->crear());
$router->agregar('GET', '/torneos/:id', fn (array $p) => (new TorneoController())->obtener($p['id']));
$router->agregar('DELETE', '/torneos/:id', fn (array $p) => (new TorneoController())->borrar($p['id']));
$router->agregar('POST', '/torneos/:id/equipos', fn (array $p) => (new TorneoController())->agregarEquipo($p['id']));
$router->agregar('POST', '/torneos/:id/sorteo', fn (array $p) => (new TorneoController())->sortear($p['id']));
$router->agregar('DELETE', '/torneo-equipos/:id', fn (array $p) => (new TorneoController())->borrarEquipo($p['id']));
$router->agregar('PUT', '/partidos/:id/resultado', fn (array $p) => (new TorneoController())->cargarResultado($p['id']));
$router->agregar('DELETE', '/partidos/:id/resultado', fn (array $p) => (new TorneoController())->borrarResultado($p['id']));
$router->agregar('PUT', '/partidos/:id/programacion', fn (array $p) => (new TorneoController())->programar($p['id']));
$router->agregar('DELETE', '/partidos/:id/programacion', fn (array $p) => (new TorneoController())->desprogramar($p['id']));

// Mercado Pago: links de pago de un turno (la API consulta el estado: no hay webhook en un servidor local)
$router->agregar('POST', '/turnos/:id/links-pago', fn (array $p) => (new LinkPagoController())->crear($p['id']));
$router->agregar('POST', '/turnos/:id/links-pago/verificar', fn (array $p) => (new LinkPagoController())->verificar($p['id']));
$router->agregar('DELETE', '/links-pago/:id', fn (array $p) => (new LinkPagoController())->anular($p['id']));
