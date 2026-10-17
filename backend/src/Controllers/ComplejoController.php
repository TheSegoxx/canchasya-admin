<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Complejo;
use App\Models\Foto;
use App\Services\Geocodificador;

/**
 * Endpoints /complejo: datos del complejo del dueño logueado.
 */
final class ComplejoController extends Controlador
{
    private Complejo $complejos;

    public function __construct()
    {
        parent::__construct();
        $this->complejos = new Complejo($this->pdo);
    }

    // GET /complejo
    public function obtener(): void
    {
        // El dueño ve el suyo; el empleado, el complejo donde trabaja
        $this->noJugador();
        $complejo = $this->esEmpleado()
            ? $this->complejoActual()
            : $this->complejos->buscarPorUsuario($this->usuarioActual());
        if ($complejo === null) {
            responder(404, ['error' => 'Todavía no configuraste tu complejo']);
        }
        $fotos = new Foto($this->pdo);
        responder(200, [
            'complejo' => $this->complejos->publico($complejo),
            'fotos' => array_map([$fotos, 'publico'], $fotos->listar((int) $complejo['id'])),
        ]);
    }

    // PUT /complejo  {nombre, direccion, ciudad?, ubicacion?: {latitud, longitud} | null, telefono, horaApertura, horaCierre, servicios[]}
    public function guardar(): void
    {
        $this->soloDueno();
        $usuarioId = $this->usuarioActual();
        $datos = leerJson();

        $telefono = trim(textoDe($datos, 'telefono'));
        if ($telefono !== '' && !preg_match('/^\+?[0-9 ()-]{6,30}$/', $telefono)) {
            responder(400, ['error' => 'El teléfono solo puede tener números, espacios, guiones y +']);
        }
        if ($telefono !== '' && strlen(preg_replace('/\D/', '', $telefono)) < 6) {
            responder(400, ['error' => 'El teléfono tiene que tener al menos 6 números']);
        }

        // El cierre puede ser 24:00 (medianoche); la apertura no
        $apertura = horaRequerida($datos, 'horaApertura', 'la hora de apertura');
        $cierre = horaRequerida($datos, 'horaCierre', 'la hora de cierre', true);
        if ($apertura >= $cierre) {
            responder(400, ['error' => 'La hora de cierre tiene que ser posterior a la de apertura']);
        }

        $servicios = $datos['servicios'] ?? [];
        $sonTextos = is_array($servicios) && array_filter($servicios, 'is_string') === $servicios;
        if (!$sonTextos || array_diff($servicios, Complejo::SERVICIOS) !== []) {
            responder(400, ['error' => 'Hay servicios que no son válidos']);
        }

        // Si no vienen (la app 1.0 no los manda) quedan como estaban
        $existente = $this->complejos->buscarPorUsuario($usuarioId) ?? [];
        $ciudad = array_key_exists('ciudad', $datos) ? trim(textoDe($datos, 'ciudad')) : (string) ($existente['ciudad'] ?? '');
        if (mb_strlen($ciudad) > 80) {
            responder(400, ['error' => 'La ciudad no puede superar los 80 caracteres']);
        }
        $ubicacion = array_key_exists('ubicacion', $datos)
            ? $this->ubicacionDeLaPeticion($datos['ubicacion'])
            : Complejo::ubicacion($existente);

        $creado = $this->complejos->guardar($usuarioId, [
            'nombre' => textoRequerido($datos, 'nombre', 150, 'el nombre del complejo'),
            'direccion' => textoRequerido($datos, 'direccion', 150, 'la dirección'),
            'ciudad' => $ciudad !== '' ? $ciudad : null,
            'latitud' => $ubicacion['latitud'] ?? null,
            'longitud' => $ubicacion['longitud'] ?? null,
            'telefono' => $telefono !== '' ? $telefono : null,
            'horaApertura' => $apertura,
            'horaCierre' => $cierre,
            'servicios' => array_values(array_unique($servicios)),
        ]);

        $complejo = $this->complejos->buscarPorUsuario($usuarioId);
        responder($creado ? 201 : 200, ['complejo' => $this->complejos->publico($complejo)]);
    }

    /**
     * GET /complejo/buscar-ubicacion?direccion=...
     * Las coordenadas de una dirección (para no tener que estar en el complejo con el GPS).
     */
    public function buscarUbicacion(): void
    {
        $this->soloDueno();
        $direccion = trim((string) ($_GET['direccion'] ?? ''));
        if (mb_strlen($direccion) < 5 || mb_strlen($direccion) > 250) {
            responder(400, ['error' => 'Escribí la dirección con la ciudad (por ejemplo, Av. Colón 1234, Córdoba)']);
        }
        $resultado = (new Geocodificador())->buscar($direccion);
        if ($resultado === null) {
            responder(404, ['error' => 'No encontramos esa dirección. Revisala o usá tu ubicación actual estando en el complejo.']);
        }
        responder(200, $resultado);
    }

    /** @return array{latitud: float, longitud: float}|null */
    private function ubicacionDeLaPeticion(mixed $ubicacion): ?array
    {
        if ($ubicacion === null) {
            return null;
        }
        $latitud = is_array($ubicacion) ? ($ubicacion['latitud'] ?? null) : null;
        $longitud = is_array($ubicacion) ? ($ubicacion['longitud'] ?? null) : null;
        $esNumero = fn ($v) => is_int($v) || is_float($v);
        if (!$esNumero($latitud) || !$esNumero($longitud) || abs($latitud) > 90 || abs($longitud) > 180) {
            responder(400, ['error' => 'La ubicación no es válida']);
        }
        return ['latitud' => round((float) $latitud, 6), 'longitud' => round((float) $longitud, 6)];
    }
}
