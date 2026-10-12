<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Usuario;
use App\Services\AuthService;
use App\Services\Correo;
use App\Services\LimiteIntentos;
use App\Services\RecuperacionPassword;

/**
 * Endpoints /auth: registro, login con contraseña, login con Google, recuperar la contraseña
 * y datos del usuario.
 */
final class AuthController extends Controlador
{
    private Usuario $usuarios;
    private AuthService $auth;
    private LimiteIntentos $limite;

    public function __construct()
    {
        parent::__construct();
        $this->usuarios = new Usuario($this->pdo);
        $this->auth = new AuthService($this->usuarios);
        $this->limite = new LimiteIntentos($this->pdo);
    }

    // POST /auth/register  {nombre, email, password}
    public function registrar(): void
    {
        // Cada registro cuenta como intento, para frenar la creación masiva de cuentas
        $this->limite->verificar(ipCliente());
        $this->limite->registrar(ipCliente());
        $datos = leerJson();

        $nombre = textoRequerido($datos, 'nombre', 100, 'el nombre');
        $email = $this->emailValido($datos);
        $password = $this->passwordValida($datos);

        $usuario = $this->auth->registrar($nombre, $email, $password);
        responder(201, [
            'token' => generarToken((int) $usuario['id']),
            'usuario' => $this->usuarios->publico($usuario),
        ]);
    }

    // POST /auth/login  {email, password}
    public function login(): void
    {
        $this->limite->verificar(ipCliente());
        $datos = leerJson();

        $email = $this->emailValido($datos);
        $usuario = $this->auth->login($email, textoDe($datos, 'password'));

        if ($usuario === null) {
            // Solo cuentan los intentos fallidos. Mismo mensaje si falla el email
            // o la contraseña, para no dar pistas
            $this->limite->registrar(ipCliente());
            responder(401, ['error' => 'Email o contraseña incorrectos']);
        }

        responder(200, [
            'token' => generarToken((int) $usuario['id']),
            'usuario' => $this->usuarios->publico($usuario),
        ]);
    }

    // POST /auth/google  {idToken}
    public function google(): void
    {
        $this->limite->verificar(ipCliente());
        $datos = leerJson();

        $idToken = textoDe($datos, 'idToken');
        if ($idToken === '') {
            responder(400, ['error' => 'Falta el token de Google']);
        }

        $resultado = $this->auth->loginGoogle($idToken);
        if ($resultado === null) {
            $this->limite->registrar(ipCliente());
            responder(401, ['error' => 'No se pudo validar la cuenta de Google']);
        }
        [$usuario, $nuevo] = $resultado;
        responder(200, [
            'token' => generarToken((int) $usuario['id']),
            'usuario' => $this->usuarios->publico($usuario),
            'nuevo' => $nuevo,
        ]);
    }

    // POST /auth/recuperar  {email}: manda un código por email para crear una contraseña nueva
    public function recuperar(): void
    {
        // Cada pedido cuenta como intento, para que no se use para mandar correos en masa
        $this->limite->verificar(ipCliente());
        $this->limite->registrar(ipCliente());
        $email = $this->emailValido(leerJson());

        if (!Correo::configurado() && ($_ENV['APP_ENV'] ?? '') !== 'desarrollo') {
            responder(503, ['error' => 'El envío de correos todavía no está configurado en el servidor']);
        }
        (new RecuperacionPassword($this->pdo, new Correo()))->pedirCodigo($email);

        // La misma respuesta exista o no la cuenta
        responder(200, ['mensaje' => 'Si el email tiene una cuenta, te llega un código en unos minutos.']);
    }

    // POST /auth/restablecer  {email, codigo, password}: con el código correcto cambia la contraseña y entra
    public function restablecer(): void
    {
        $this->limite->verificar(ipCliente());
        $datos = leerJson();

        $email = $this->emailValido($datos);
        $codigo = textoDe($datos, 'codigo');
        if (preg_match('/^\d{6}$/', $codigo) !== 1) {
            responder(400, ['error' => 'El código tiene 6 números']);
        }
        $password = $this->passwordValida($datos);

        $usuario = (new RecuperacionPassword($this->pdo, new Correo()))->restablecer($email, $codigo, $password);
        if ($usuario === null) {
            $this->limite->registrar(ipCliente());
            responder(400, ['error' => 'El código no es correcto o ya venció. Revisalo o pedí uno nuevo.']);
        }

        responder(200, [
            'token' => generarToken((int) $usuario['id']),
            'usuario' => $this->usuarios->publico($usuario),
        ]);
    }

    // GET /auth/yo  (requiere token)
    public function yo(): void
    {
        $usuario = $this->usuarios->buscarPorId($this->usuarioActual());
        if ($usuario === null) {
            responder(401, ['error' => 'La cuenta ya no existe']);
        }
        responder(200, ['usuario' => $this->usuarios->publico($usuario)]);
    }

    private function passwordValida(array $datos): string
    {
        $password = textoDe($datos, 'password');
        if (mb_strlen($password) < 8) {
            responder(400, ['error' => 'La contraseña debe tener al menos 8 caracteres']);
        }
        if (strlen($password) > 72) {
            // bcrypt solo usa los primeros 72 bytes
            responder(400, ['error' => 'La contraseña no puede superar los 72 caracteres']);
        }
        return $password;
    }

    private function emailValido(array $datos): string
    {
        $email = mb_strtolower(textoRequerido($datos, 'email', 150, 'el email'));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            responder(400, ['error' => 'El email no es válido']);
        }
        return $email;
    }
}
