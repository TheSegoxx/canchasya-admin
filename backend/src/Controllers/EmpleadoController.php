<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ErrorHttp;
use App\Models\Invitacion;
use App\Models\Usuario;
use App\Services\LimiteIntentos;

/**
 * Endpoints /empleados e /invitaciones: el dueño invita a encargados con un código
 * y les puede quitar el acceso; el empleado se une a un complejo con ese código.
 */
final class EmpleadoController extends Controlador
{
    private Usuario $usuarios;
    private Invitacion $invitaciones;

    public function __construct()
    {
        parent::__construct();
        $this->usuarios = new Usuario($this->pdo);
        $this->invitaciones = new Invitacion($this->pdo);
    }

    // GET /empleados  (con las invitaciones que todavía no se usaron)
    public function listar(): void
    {
        $this->soloDueno();
        $complejoId = (int) $this->complejoActual()['id'];
        responder(200, [
            'empleados' => array_map(
                fn (array $u) => ['id' => (int) $u['id'], 'nombre' => $u['nombre'], 'email' => $u['email'], 'foto' => $u['foto_url']],
                $this->usuarios->listarEmpleados($complejoId)
            ),
            'invitaciones' => array_map([$this->invitaciones, 'publico'], $this->invitaciones->listarVigentes($complejoId)),
        ]);
    }

    // POST /invitaciones  -> {codigo, invitacion}. El código se muestra esta única vez.
    public function invitar(): void
    {
        $this->soloDueno();
        $complejoId = (int) $this->complejoActual()['id'];
        if (count($this->invitaciones->listarVigentes($complejoId)) >= Invitacion::MAXIMO_VIGENTES) {
            responder(409, ['error' => 'Ya tenés ' . Invitacion::MAXIMO_VIGENTES . ' invitaciones sin usar. Anulá alguna para crear otra.']);
        }
        $codigo = Invitacion::generarCodigo();
        $id = $this->invitaciones->crear($complejoId, $codigo);
        responder(201, [
            'codigo' => $codigo,
            'invitacion' => $this->invitaciones->publico($this->invitaciones->buscarPorId($id)),
        ]);
    }

    // DELETE /invitaciones/:id  (anular un código que no se usó)
    public function anularInvitacion(int $id): void
    {
        $this->soloDueno();
        $this->verificarDelComplejo($this->invitaciones->buscarConDueno($id), 'La invitación');
        $this->invitaciones->borrar($id);
        responder(204);
    }

    // DELETE /empleados/:id  (quitar el acceso: la cuenta sigue existiendo, pero sin el complejo)
    public function quitar(int $id): void
    {
        $this->soloDueno();
        $empleado = $this->usuarios->buscarPorId($id);
        if ($empleado === null || $empleado['rol'] !== 'empleado'
            || (int) $empleado['complejo_id'] !== (int) $this->complejoActual()['id']) {
            responder(404, ['error' => 'Ese empleado no trabaja en tu complejo']);
        }
        $this->usuarios->quitarDelComplejo($id);
        responder(204);
    }

    /**
     * POST /invitaciones/aceptar  {codigo}
     * La cuenta logueada pasa a ser empleado del complejo de la invitación.
     */
    public function aceptar(): void
    {
        // Mismo límite que el login: frena a quien quiera adivinar códigos
        $limite = new LimiteIntentos($this->pdo);
        $limite->verificar(ipCliente());

        $usuario = $this->usuario();
        if ($usuario['rol'] === 'empleado' && $usuario['complejo_id'] !== null) {
            responder(409, ['error' => 'Ya trabajás en un complejo. Pedile al dueño que te quite el acceso para unirte a otro.']);
        }
        if ($usuario['rol'] === 'dueno' && $this->usuarios->nombreDelComplejo($usuario) !== null) {
            responder(409, ['error' => 'Tu cuenta ya tiene su propio complejo. Usá otra cuenta para trabajar como empleado.']);
        }

        $codigo = textoDe(leerJson(), 'codigo');
        try {
            $this->transaccion(function () use ($codigo, $usuario) {
                $invitacion = $this->invitaciones->buscarVigentePorCodigo($codigo);
                if ($invitacion === null) {
                    throw new ErrorHttp(404, 'El código no existe, ya se usó o venció. Pedile uno nuevo al dueño.');
                }
                $this->invitaciones->marcarUsada((int) $invitacion['id'], (int) $usuario['id']);
                $this->usuarios->hacerEmpleado((int) $usuario['id'], (int) $invitacion['complejo_id']);
            });
        } catch (ErrorHttp $e) {
            $limite->registrar(ipCliente());
            throw $e;
        }

        responder(200, ['usuario' => $this->usuarios->publico($this->usuarios->buscarPorId((int) $usuario['id']))]);
    }
}
