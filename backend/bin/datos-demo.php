<?php

declare(strict_types=1);

/**
 * Carga una cuenta de demostración con datos para ver la app funcionando:
 * complejo, canchas con precios por franja, productos, turnos de hoy y de los próximos días
 * (pagados, señados y sin pagar), un turno fijo, un bloqueo, un mes de historial para el
 * dashboard, gastos e ingresos, una liga con resultados y un encargado.
 *
 * Usa la API (Apache y MySQL de XAMPP encendidos) y la base solo para el historial,
 * porque la API no deja cargar turnos en días pasados. Las fechas son relativas a hoy.
 * Si la cuenta ya existe, se borra y se vuelve a crear.
 *
 *   C:\xampp\php\php.exe bin\datos-demo.php [http://localhost/canchasya/api]
 *
 * Cuentas: demo@canchasya.test / demo1234 (dueño) y encargado@canchasya.test / demo1234.
 */

use App\Database;
use Dotenv\Dotenv;

if (PHP_SAPI !== 'cli') {
    exit;
}

$raiz = dirname(__DIR__);
require $raiz . '/vendor/autoload.php';
date_default_timezone_set('America/Argentina/Buenos_Aires');
Dotenv::createImmutable($raiz)->load();

const DUENO = 'demo@canchasya.test';
const ENCARGADO = 'encargado@canchasya.test';
const JUGADOR = 'jugador@canchasya.test';
const CLAVE = 'demo1234';

$api = rtrim($argv[1] ?? 'http://localhost/canchasya/api', '/');
$pdo = Database::conexion();

function pedir(string $metodo, string $ruta, ?array $cuerpo = null, ?string $token = null): array
{
    global $api;
    $curl = curl_init($api . $ruta);
    $encabezados = ['Content-Type: application/json', 'Accept: application/json'];
    if ($token !== null) {
        $encabezados[] = "Authorization: Bearer $token";
    }
    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $metodo,
        CURLOPT_HTTPHEADER => $encabezados,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    if ($cuerpo !== null) {
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($cuerpo, JSON_UNESCAPED_UNICODE));
    }
    $respuesta = curl_exec($curl);
    $codigo = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($respuesta === false || $codigo === 0) {
        fwrite(STDERR, "No se pudo conectar con $api. ¿Está Apache encendido?\n");
        exit(1);
    }
    $datos = json_decode((string) $respuesta, true) ?? [];
    if ($codigo >= 400) {
        fwrite(STDERR, "Error en $metodo $ruta ($codigo): " . ($datos['error'] ?? $respuesta) . "\n");
        exit(1);
    }
    return $datos;
}

function fecha(int $dias): string
{
    return date('Y-m-d', strtotime("$dias days"));
}

// 1) Si ya estaba la demo, se borra (en orden, por las claves foráneas sin borrado en cascada)
$stmt = $pdo->prepare('SELECT id FROM usuarios WHERE email IN (?, ?, ?)');
$stmt->execute([DUENO, ENCARGADO, JUGADOR]);
$anteriores = $stmt->fetchAll(PDO::FETCH_COLUMN);
if ($anteriores !== []) {
    $marcas = implode(', ', array_fill(0, count($anteriores), '?'));
    $complejos = "SELECT id FROM complejos WHERE usuario_id IN ($marcas)";
    $pdo->prepare("DELETE p FROM partidos p JOIN torneos t ON t.id = p.torneo_id WHERE t.complejo_id IN ($complejos)")->execute($anteriores);
    $pdo->prepare("DELETE t FROM turnos t JOIN canchas c ON c.id = t.cancha_id WHERE c.complejo_id IN ($complejos)")->execute($anteriores);
    $pdo->prepare("DELETE f FROM turnos_fijos f JOIN canchas c ON c.id = f.cancha_id WHERE c.complejo_id IN ($complejos)")->execute($anteriores);
    $pdo->prepare("DELETE FROM usuarios WHERE id IN ($marcas)")->execute($anteriores);
    echo "Se borró la demo anterior.\n";
}
// El límite de registros por IP no tiene que frenar este script
$pdo->exec("DELETE FROM intentos_login WHERE ip IN ('127.0.0.1', '::1')");

// 2) Cuentas, complejo, canchas y productos
$token = pedir('POST', '/auth/register', [
    'nombre' => 'Martín Gómez', 'email' => DUENO, 'password' => CLAVE, 'rol' => 'dueno', 'telefono' => '11 4000 1234',
])['token'];
$tokenEncargado = pedir('POST', '/auth/register', [
    'nombre' => 'Lucía Fernández', 'email' => ENCARGADO, 'password' => CLAVE, 'rol' => 'dueno', 'telefono' => '11 4000 5678',
])['token'];
// Un jugador para probar la parte de los clientes
pedir('POST', '/auth/register', [
    'nombre' => 'Sofía Herrera', 'email' => JUGADOR, 'password' => CLAVE, 'rol' => 'jugador',
    'telefono' => '11 3000 0101', 'ciudad' => 'Almagro', 'deportes' => ['padel', 'futbol5'],
]);

pedir('PUT', '/complejo', [
    'nombre' => 'Complejo Demo CanchasYa',
    'direccion' => 'Av. Rivadavia 4500, CABA',
    'ciudad' => 'Almagro',
    'ubicacion' => ['latitud' => -34.610745, 'longitud' => -58.424378],
    'telefono' => '11 4000 1234',
    'horaApertura' => '08:00',
    'horaCierre' => '24:00',
    'servicios' => ['vestuarios', 'duchas', 'buffet', 'estacionamiento', 'wifi'],
], $token);
// Toma reservas desde la app con una seña del 30 % (media hora para pagarla)
// y tiene programa de fidelidad: cada 10 turnos jugados, uno gratis
pedir('PUT', '/complejo/reservas', [
    'aceptaReservas' => true, 'senaPorcentaje' => 30, 'senaMinutos' => 30, 'reservaDias' => 14, 'cancelacionHoras' => 24,
    'fidelidadTurnos' => 10, 'fidelidadDescuento' => 100,
], $token);

$canchas = [];
foreach ([
    ['Pádel 1', 'padel', 90, 24000, 'Sintético', true, 30000],
    ['Pádel 2', 'padel', 90, 24000, 'Cemento', false, 30000],
    ['Fútbol 5', 'futbol5', 60, 36000, 'Césped sintético', false, 45000],
] as [$nombre, $deporte, $duracion, $precio, $superficie, $techada, $precioNoche]) {
    $id = pedir('POST', '/canchas', [
        'nombre' => $nombre, 'deporte' => $deporte, 'duracionMin' => $duracion, 'precioBase' => $precio,
        'superficie' => $superficie, 'techada' => $techada,
    ], $token)['cancha']['id'];
    // Desde las 18 la cancha vale más
    pedir('POST', "/canchas/$id/franjas", ['horaDesde' => '18:00', 'horaHasta' => '24:00', 'precio' => $precioNoche], $token);
    $canchas[$nombre] = $id;
}

$productos = [];
foreach ([['Alquiler de paletas', 3000], ['Tubo de pelotas', 9000], ['Agua mineral', 1500], ['Bebida isotónica', 2500]] as [$nombre, $precio]) {
    $productos[$nombre] = pedir('POST', '/productos', ['nombre' => $nombre, 'precio' => $precio], $token)['producto']['id'];
}

// 3) Encargado: el dueño lo invita con un código
$codigo = pedir('POST', '/invitaciones', null, $token)['codigo'];
pedir('POST', '/invitaciones/aceptar', ['codigo' => $codigo], $tokenEncargado);

// 4) Turnos de hoy y de los próximos días
$clientes = [
    ['Juan Pérez', '11 5555 0101'], ['Sofía Romero', '11 5555 0102'], ['Diego Álvarez', '11 5555 0103'],
    ['Valentina Díaz', '11 5555 0104'], ['Nicolás Torres', '11 5555 0105'], ['Camila Ruiz', '11 5555 0106'],
    ['Matías Herrera', '11 5555 0107'], ['Florencia Castro', '11 5555 0108'], ['Tomás Molina', '11 5555 0109'],
    ['Agustina Silva', '11 5555 0110'],
];
$siguiente = 0;
$reservar = function (string $cancha, int $dias, string $hora, ?array $sena = null, bool $fijo = false) use (&$siguiente, $clientes, $canchas, $token): array {
    [$nombre, $telefono] = $clientes[$siguiente++ % count($clientes)];
    $cuerpo = ['canchaId' => $canchas[$cancha], 'fecha' => fecha($dias), 'horaInicio' => $hora,
        'cliente' => ['nombre' => $nombre, 'telefono' => $telefono], 'fijo' => $fijo];
    if ($sena !== null) {
        $cuerpo['sena'] = ['monto' => $sena[0], 'metodo' => $sena[1]];
    }
    return pedir('POST', '/turnos', $cuerpo, $token)['turno'];
};
$pagarSaldo = function (array $turno, string $metodo) use ($token): void {
    $cuenta = pedir('GET', "/turnos/{$turno['id']}", null, $token)['turno'];
    $saldo = $cuenta['total'] - $cuenta['pagado'];
    if ($saldo > 0) {
        pedir('POST', "/turnos/{$turno['id']}/pagos", ['monto' => $saldo, 'metodo' => $metodo], $token);
    }
};

// Hoy: a la mañana ya jugados y pagados; a la tarde y noche, señados o sin pagar
$t = $reservar('Fútbol 5', 0, '10:00', [10000, 'transferencia']);
pedir('POST', "/turnos/{$t['id']}/consumos", ['productoId' => $productos['Agua mineral'], 'cantidad' => 4], $token);
$pagarSaldo($t, 'efectivo');
pedir('PATCH', "/turnos/{$t['id']}/estado", ['estado' => 'jugado'], $token);
$t = $reservar('Pádel 1', 0, '09:00');
pedir('POST', "/turnos/{$t['id']}/consumos", ['productoId' => $productos['Alquiler de paletas'], 'cantidad' => 2], $token);
$pagarSaldo($t, 'efectivo');
pedir('PATCH', "/turnos/{$t['id']}/estado", ['estado' => 'jugado'], $token);
$t = $reservar('Pádel 2', 0, '15:00', [8000, 'transferencia']);
$pagarSaldo($t, 'transferencia');
$reservar('Fútbol 5', 0, '18:00', [15000, 'transferencia']);
$reservar('Fútbol 5', 0, '19:00');
$reservar('Fútbol 5', 0, '20:00', [15000, 'efectivo']);
$reservar('Fútbol 5', 0, '22:00');
$reservar('Pádel 1', 0, '18:00', [10000, 'transferencia']);
$reservar('Pádel 1', 0, '21:00');
$reservar('Pádel 2', 0, '19:30', [10000, 'efectivo']);

// Turno fijo (todas las semanas) y próximos días
$reservar('Fútbol 5', 1, '21:00', [15000, 'transferencia'], true);
$reservar('Fútbol 5', 1, '20:00');
$reservar('Pádel 1', 1, '19:30', [10000, 'efectivo']);
$reservar('Pádel 2', 2, '18:00');
$reservar('Fútbol 5', 2, '19:00', [15000, 'transferencia']);
$reservar('Pádel 1', 3, '20:00');

// Bloqueo por mantenimiento
pedir('POST', '/bloqueos', ['canchaIds' => [$canchas['Pádel 2']], 'fecha' => fecha(1), 'horaDesde' => '08:00',
    'horaHasta' => '11:00', 'motivo' => 'Mantenimiento de la cancha', 'cancelarTurnos' => false], $token);

// 5) Gastos e ingresos cargados a mano en el último mes
foreach ([
    ['egreso', 'sueldos', 450000, 'transferencia', -25, 'Sueldo del encargado'],
    ['egreso', 'alquiler', 600000, 'transferencia', -24, 'Alquiler del predio'],
    ['egreso', 'servicios', 85000, 'transferencia', -18, 'Luz (iluminación de las canchas)'],
    ['egreso', 'compras', 62000, 'efectivo', -12, 'Bebidas para el buffet'],
    ['egreso', 'mantenimiento', 48000, 'efectivo', -6, 'Redes y pelotas nuevas'],
    ['ingreso', 'eventos', 180000, 'transferencia', -9, 'Cumpleaños infantil'],
    ['ingreso', 'ventas', 35000, 'efectivo', -3, 'Venta de paletas usadas'],
] as [$tipo, $categoria, $monto, $metodo, $dias, $descripcion]) {
    pedir('POST', '/movimientos', ['tipo' => $tipo, 'categoria' => $categoria, 'monto' => $monto, 'metodo' => $metodo,
        'fecha' => fecha($dias), 'descripcion' => $descripcion], $token);
}

// 6) Liga de fútbol 5 con dos resultados
$torneo = pedir('POST', '/torneos', ['nombre' => 'Liga de Primavera', 'deporte' => 'futbol5', 'formato' => 'liga'], $token)['torneo']['id'];
foreach (['Los Pibes', 'La Banda', 'Real Madrazo', 'Atlético Asado'] as $i => $equipo) {
    pedir('POST', "/torneos/$torneo/equipos", ['nombre' => $equipo, 'integrantes' => 'Juan, Pedro, Lucas, Mateo, Bruno',
        'telefono' => '11 6000 00' . ($i + 10)], $token);
}
$partidos = pedir('POST', "/torneos/$torneo/sorteo", null, $token)['partidos'];
pedir('PUT', "/partidos/{$partidos[0]['id']}/resultado", ['local' => 3, 'visitante' => 1], $token);
pedir('PUT', "/partidos/{$partidos[1]['id']}/resultado", ['local' => 2, 'visitante' => 2], $token);
pedir('PUT', "/partidos/{$partidos[2]['id']}/programacion", ['canchaId' => $canchas['Fútbol 5'], 'fecha' => fecha(4), 'hora' => '20:00'], $token);

// 7) Historial de los últimos 30 días para el dashboard (directo en la base)
$complejoId = (int) $pdo->query("SELECT x.id FROM complejos x JOIN usuarios u ON u.id = x.usuario_id WHERE u.email = '" . DUENO . "'")->fetchColumn();
$idsClientes = $pdo->query("SELECT id FROM clientes WHERE complejo_id = $complejoId")->fetchAll(PDO::FETCH_COLUMN);
$turno = $pdo->prepare(
    "INSERT INTO turnos (cancha_id, cliente_id, fecha, hora_inicio, hora_fin, precio, estado, estado_pago)
     VALUES (?, ?, ?, ?, ?, ?, 'jugado', 'pagado')"
);
$pago = $pdo->prepare('INSERT INTO pagos (turno_id, monto, metodo, concepto, fecha_pago) VALUES (?, ?, ?, ?, ?)');
mt_srand(2610);
$cargados = 0;
$pdo->beginTransaction();
for ($d = -30; $d <= -1; $d++) {
    $dia = fecha($d);
    $finDeSemana = (int) date('N', strtotime($dia)) >= 5;
    foreach ($canchas as $nombre => $canchaId) {
        $futbol = $nombre === 'Fútbol 5';
        $horas = $futbol ? ['18:00', '19:00', '20:00', '21:00', '22:00'] : ['17:30', '19:00', '20:30'];
        foreach ($horas as $hora) {
            // Más ocupación los fines de semana
            if (mt_rand(1, 100) > ($finDeSemana ? 85 : 55)) {
                continue;
            }
            $precio = $futbol ? 45000 : 30000;
            $fin = date('H:i', strtotime("$dia $hora") + ($futbol ? 3600 : 5400));
            $turno->execute([$canchaId, $idsClientes[array_rand($idsClientes)], $dia, $hora, $fin === '00:00' ? '24:00' : $fin, $precio]);
            $id = (int) $pdo->lastInsertId();
            $metodo = ['efectivo', 'efectivo', 'transferencia', 'mercadopago'][mt_rand(0, 3)];
            $sena = $futbol ? 15000 : 10000;
            $pago->execute([$id, $sena, 'transferencia', 'sena', date('Y-m-d H:i:s', strtotime("$dia 12:00") - 86400)]);
            $pago->execute([$id, $precio - $sena, $metodo, 'saldo', "$dia $hora:00"]);
            $cargados++;
        }
    }
}
$pdo->commit();

echo "Demo lista: $cargados turnos de historial.\n";
echo 'Dueño: ' . DUENO . ' / ' . CLAVE . "\n";
echo 'Encargado: ' . ENCARGADO . ' / ' . CLAVE . "\n";
echo 'Jugador: ' . JUGADOR . ' / ' . CLAVE . "\n";
