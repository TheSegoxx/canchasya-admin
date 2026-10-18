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

// Valida una fecha "AAAA-MM-DD" que exista en el calendario
function fechaValida(string $valor): bool
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $valor, $partes)) {
        return false;
    }
    return checkdate((int) $partes[2], (int) $partes[3], (int) $partes[1]);
}

function fechaRequerida(array $datos, string $campo, string $nombreVisible): string
{
    $valor = textoDe($datos, $campo);
    if (!fechaValida($valor)) {
        responder(400, ['error' => "Falta $nombreVisible o no tiene el formato AAAA-MM-DD"]);
    }
    return $valor;
}

// Fecha de hoy en Argentina (la zona horaria se fija en public/index.php)
function hoy(): string
{
    return date('Y-m-d');
}

function sumarDias(string $fecha, int $dias): string
{
    return date('Y-m-d', strtotime("$fecha $dias days"));
}

// 1 = lunes ... 7 = domingo
function diaDeLaSemana(string $fecha): int
{
    return (int) date('N', strtotime($fecha));
}

// "18/10" para los mensajes
function fechaCorta(string $fecha): string
{
    return date('d/m', strtotime($fecha));
}

// "20:30:00" -> 1230. Acepta "24:00:00" (medianoche al final del día)
function minutosDe(string $hora): int
{
    [$h, $m] = explode(':', $hora);
    return (int) $h * 60 + (int) $m;
}

// 1230 -> "20:30:00"
function horaDe(int $minutos): string
{
    return sprintf('%02d:%02d:00', intdiv($minutos, 60), $minutos % 60);
}

// "20:30:00" -> "20:30"
function horaCorta(string $hora): string
{
    return substr($hora, 0, 5);
}

// 60 -> "1 hora", 90 -> "1 h 30 min", 120 -> "2 horas"
function duracionVisible(int $minutos): string
{
    $horas = intdiv($minutos, 60);
    $resto = $minutos % 60;
    if ($resto === 0) {
        return $horas === 1 ? '1 hora' : "$horas horas";
    }
    return $horas === 0 ? "$resto min" : "$horas h $resto min";
}

/**
 * Deja un celular argentino en 10 cifras (código de área + número, sin 0 ni 15),
 * que es lo que necesita el link de WhatsApp. Acepta lo que escribe la gente:
 * "+54 9 11 5555-1234", "011 15 5555 1234", "351 155 123456"...
 * Si no parece argentino se guardan las cifras tal cual. Null si no es un teléfono.
 */
function normalizarTelefono(string $texto): ?string
{
    $cifras = preg_replace('/\D/', '', $texto);
    if (str_starts_with($cifras, '549') && strlen($cifras) === 13) {
        $cifras = substr($cifras, 3);
    } elseif (str_starts_with($cifras, '54') && strlen($cifras) === 12) {
        $cifras = substr($cifras, 2);
    }
    if (str_starts_with($cifras, '0')) {
        $cifras = substr($cifras, 1);
    }
    // Con el 15 quedan 12 cifras: el código de área tiene de 2 a 4
    if (strlen($cifras) === 12) {
        foreach ([2, 3, 4] as $largoArea) {
            if (substr($cifras, $largoArea, 2) === '15') {
                $cifras = substr($cifras, 0, $largoArea) . substr($cifras, $largoArea + 2);
                break;
            }
        }
    }
    $largo = strlen($cifras);
    return $largo >= 8 && $largo <= 15 ? $cifras : null;
}

// 1 -> "lunes" ... 7 -> "domingos", para "todos los ..."
function diaEnPlural(int $diaSemana): string
{
    return ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'][$diaSemana - 1];
}

// Id numérico que manda la app en el JSON; responde 400 si falta
function idRequerido(array $datos, string $campo, string $nombreVisible): int
{
    $valor = $datos[$campo] ?? null;
    if (!is_int($valor) || $valor <= 0) {
        responder(400, ['error' => "Falta $nombreVisible"]);
    }
    return $valor;
}

function booleanoOpcional(array $datos, string $campo, string $nombreVisible): bool
{
    $valor = $datos[$campo] ?? false;
    if (!is_bool($valor)) {
        responder(400, ['error' => "El campo $nombreVisible tiene que ser verdadero o falso"]);
    }
    return $valor;
}

// "$ 24.000" o "$ 24.000,50" para los mensajes (igual que en la app)
function pesos(float $monto): string
{
    $decimales = fmod($monto, 1.0) == 0.0 ? 0 : 2;
    return '$ ' . number_format($monto, $decimales, ',', '.');
}

// Valida {monto, metodo} de un pago; responde 400 si algo no está bien
function pagoValido(array $datos): array
{
    $monto = precioRequerido($datos, 'monto', 'el monto');
    if ($monto <= 0) {
        responder(400, ['error' => 'El monto tiene que ser mayor a cero']);
    }
    $metodo = textoDe($datos, 'metodo');
    if (!in_array($metodo, App\Models\Pago::METODOS, true)) {
        responder(400, ['error' => 'El medio de pago tiene que ser efectivo o transferencia']);
    }
    return ['monto' => $monto, 'metodo' => $metodo];
}

/**
 * Rango ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD de la consulta (como mucho un año).
 *
 * @return array{0: string, 1: string}
 */
function rangoDeFechas(): array
{
    $desde = $_GET['desde'] ?? '';
    $hasta = $_GET['hasta'] ?? '';
    if (!is_string($desde) || !is_string($hasta) || !fechaValida($desde) || !fechaValida($hasta)) {
        responder(400, ['error' => 'Faltan las fechas desde y hasta (AAAA-MM-DD)']);
    }
    if ($desde > $hasta) {
        responder(400, ['error' => 'La fecha desde tiene que ser anterior a la fecha hasta']);
    }
    if (strtotime($hasta) - strtotime($desde) > 366 * 86400) {
        responder(400, ['error' => 'El período no puede ser de más de un año']);
    }
    return [$desde, $hasta];
}

// "jueves 16 de octubre" (sin barras: Mercado Pago las borra de los títulos)
function fechaLarga(string $fecha): string
{
    $dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    $meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    $marca = strtotime($fecha);
    return $dias[(int) date('N', $marca) - 1] . ' ' . (int) date('j', $marca) . ' de ' . $meses[(int) date('n', $marca) - 1];
}
