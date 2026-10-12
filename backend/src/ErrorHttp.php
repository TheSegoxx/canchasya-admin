<?php

declare(strict_types=1);

namespace App;

use RuntimeException;

/**
 * Error que se le explica al cliente (409 por horario ocupado, etc.).
 * Se usa dentro de las transacciones: al lanzarla se deshacen los cambios
 * y public/index.php responde con el código y el mensaje.
 */
final class ErrorHttp extends RuntimeException
{
    /** @param array<string, mixed> $extra datos adicionales para la app */
    public function __construct(public readonly int $codigo, string $mensaje, public readonly array $extra = [])
    {
        parent::__construct($mensaje);
    }
}
