<?php

declare(strict_types=1);

/**
 * Tarea programada de las notificaciones automáticas (recordatorios, pagos de
 * Mercado Pago y resumen de caja). La corre el Programador de tareas de Windows
 * cada minuto (ver bin/instalar-avisos.bat). Para probarla a mano:
 *   C:\xampp\php\php.exe bin\avisos.php
 */

use App\Database;
use App\Services\AvisosAutomaticos;
use Dotenv\Dotenv;

if (PHP_SAPI !== 'cli') {
    exit;
}

$raiz = dirname(__DIR__);
require $raiz . '/vendor/autoload.php';
date_default_timezone_set('America/Argentina/Buenos_Aires');
Dotenv::createImmutable($raiz)->load();

$registro = $raiz . '/storage/avisos.log';
$escribir = function (string $texto) use ($registro): void {
    echo $texto . PHP_EOL;
    file_put_contents($registro, '[' . date('Y-m-d H:i:s') . "] $texto" . PHP_EOL, FILE_APPEND | LOCK_EX);
};

// Si la vuelta anterior todavía no terminó (por ejemplo, Mercado Pago tarda), esta no arranca
$candado = fopen($raiz . '/storage/avisos.lock', 'c');
if (!flock($candado, LOCK_EX | LOCK_NB)) {
    exit;
}

try {
    $hecho = (new AvisosAutomaticos(Database::conexion()))->revisar();
    // Solo se registra cuando pasó algo, para que el log no crezca cada minuto
    $resumen = implode(' | ', $hecho);
    if (preg_match('/: [1-9]|ERROR/', $resumen) === 1) {
        $escribir($resumen);
    }
} catch (Throwable $e) {
    // Por ejemplo, MySQL apagado
    $escribir('ERROR ' . $e->getMessage());
}
flock($candado, LOCK_UN);
