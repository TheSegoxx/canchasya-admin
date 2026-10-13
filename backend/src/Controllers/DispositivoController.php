<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Dispositivo;

/**
 * Endpoints /dispositivos: el celular avisa su token de Firebase para recibir notificaciones.
 */
final class DispositivoController extends Controlador
{
    // POST /dispositivos  {token}  (al iniciar sesión y cuando Firebase renueva el token)
    public function registrar(): void
    {
        (new Dispositivo($this->pdo))->registrar($this->usuarioActual(), $this->tokenValido());
        responder(200, ['ok' => true]);
    }

    // POST /dispositivos/baja  {token}  (al cerrar sesión: ese celular deja de recibirlas)
    public function quitar(): void
    {
        (new Dispositivo($this->pdo))->quitar($this->usuarioActual(), $this->tokenValido());
        responder(200, ['ok' => true]);
    }

    private function tokenValido(): string
    {
        $token = textoDe(leerJson(), 'token');
        if (preg_match('/^[A-Za-z0-9_:.\-]{20,512}$/', $token) !== 1) {
            responder(400, ['error' => 'El token del dispositivo no es válido']);
        }
        return $token;
    }
}
