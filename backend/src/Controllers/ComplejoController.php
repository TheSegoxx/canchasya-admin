<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Complejo;

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
        $complejo = $this->complejos->buscarPorUsuario($this->usuarioActual());
        if ($complejo === null) {
            responder(404, ['error' => 'Todavía no configuraste tu complejo']);
        }
        responder(200, ['complejo' => $this->complejos->publico($complejo)]);
    }

    // PUT /complejo  {nombre, direccion, telefono, horaApertura, horaCierre, servicios[]}
    public function guardar(): void
    {
        $usuarioId = $this->usuarioActual();
        $datos = leerJson();

        $telefono = trim((string) ($datos['telefono'] ?? ''));
        if ($telefono !== '' && !preg_match('/^\+?[0-9 ()-]{6,30}$/', $telefono)) {
            responder(400, ['error' => 'El teléfono solo puede tener números, espacios, guiones y +']);
        }

        // El cierre puede ser 24:00 (medianoche); la apertura no
        $apertura = $this->hora($datos, 'horaApertura', 'la hora de apertura', false);
        $cierre = $this->hora($datos, 'horaCierre', 'la hora de cierre', true);
        if ($apertura >= $cierre) {
            responder(400, ['error' => 'La hora de cierre tiene que ser posterior a la de apertura']);
        }

        $servicios = $datos['servicios'] ?? [];
        if (!is_array($servicios) || array_diff($servicios, Complejo::SERVICIOS) !== []) {
            responder(400, ['error' => 'Hay servicios que no son válidos']);
        }

        $creado = $this->complejos->guardar($usuarioId, [
            'nombre' => textoRequerido($datos, 'nombre', 150, 'el nombre del complejo'),
            'direccion' => textoRequerido($datos, 'direccion', 150, 'la dirección'),
            'telefono' => $telefono !== '' ? $telefono : null,
            'horaApertura' => $apertura,
            'horaCierre' => $cierre,
            'servicios' => array_values(array_unique($servicios)),
        ]);

        $complejo = $this->complejos->buscarPorUsuario($usuarioId);
        responder($creado ? 201 : 200, ['complejo' => $this->complejos->publico($complejo)]);
    }

    // Valida una hora "HH:MM" y la devuelve como "HH:MM:00" (comparable como texto)
    private function hora(array $datos, string $campo, string $nombreVisible, bool $admiteMedianoche): string
    {
        $valor = (string) ($datos[$campo] ?? '');
        $valida = preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $valor)
            || ($admiteMedianoche && $valor === '24:00');
        if (!$valida) {
            responder(400, ['error' => "Falta $nombreVisible o no tiene el formato HH:MM"]);
        }
        return "$valor:00";
    }
}
