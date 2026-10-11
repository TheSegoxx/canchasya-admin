<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Cancha;
use App\Models\Complejo;
use App\Models\FranjaPrecio;

/**
 * Endpoints /canchas y /franjas: alta, edición, estado, habilitación y precios por horario.
 */
final class CanchaController extends Controlador
{
    private Cancha $canchas;
    private FranjaPrecio $franjas;

    public function __construct()
    {
        parent::__construct();
        $this->canchas = new Cancha($this->pdo);
        $this->franjas = new FranjaPrecio($this->pdo);
    }

    // GET /canchas
    public function listar(): void
    {
        $complejo = $this->complejoDelDueno();
        $lista = $this->canchas->listarPorComplejo((int) $complejo['id']);
        responder(200, ['canchas' => array_map([$this->canchas, 'publico'], $lista)]);
    }

    // GET /canchas/:id  (con sus franjas, para la pantalla de edición)
    public function obtener(int $id): void
    {
        $cancha = $this->canchaPropia($id);
        responder(200, [
            'cancha' => $this->canchas->publico($cancha),
            'franjas' => array_map([$this->franjas, 'publico'], $this->franjas->listarPorCancha($id)),
        ]);
    }

    // POST /canchas  {nombre, deporte, superficie, techada, duracionMin, precioBase}
    public function crear(): void
    {
        $complejoId = (int) $this->complejoDelDueno()['id'];
        $datos = $this->datosValidos(leerJson());
        $this->verificarNombreLibre($complejoId, $datos['nombre']);
        $id = $this->canchas->crear($complejoId, $datos);
        responder(201, ['cancha' => $this->canchas->publico($this->canchas->buscarPorId($id))]);
    }

    // PUT /canchas/:id  (mismos campos que al crear)
    public function editar(int $id): void
    {
        $cancha = $this->canchaPropia($id);
        $datos = $this->datosValidos(leerJson());
        $this->verificarNombreLibre((int) $cancha['complejo_id'], $datos['nombre'], $id);
        $this->canchas->editar($id, $datos);
        responder(200, ['cancha' => $this->canchas->publico($this->canchas->buscarPorId($id))]);
    }

    // PATCH /canchas/:id/estado  {estado: "libre"|"ocupada"}
    public function cambiarEstado(int $id): void
    {
        $this->canchaPropia($id);
        $estado = (string) (leerJson()['estado'] ?? '');
        if (!in_array($estado, Cancha::ESTADOS, true)) {
            responder(400, ['error' => 'El estado tiene que ser libre u ocupada']);
        }
        $this->canchas->cambiarEstado($id, $estado);
        responder(200, ['cancha' => $this->canchas->publico($this->canchas->buscarPorId($id))]);
    }

    // PATCH /canchas/:id/habilitada  {habilitada: true|false}
    public function cambiarHabilitada(int $id): void
    {
        $this->canchaPropia($id);
        $habilitada = leerJson()['habilitada'] ?? null;
        if (!is_bool($habilitada)) {
            responder(400, ['error' => 'Falta indicar si la cancha está habilitada']);
        }
        $this->canchas->cambiarHabilitada($id, $habilitada);
        responder(200, ['cancha' => $this->canchas->publico($this->canchas->buscarPorId($id))]);
    }

    // GET /canchas/:id/franjas
    public function listarFranjas(int $id): void
    {
        $this->canchaPropia($id);
        responder(200, ['franjas' => array_map([$this->franjas, 'publico'], $this->franjas->listarPorCancha($id))]);
    }

    // POST /canchas/:id/franjas  {horaDesde, horaHasta, precio}
    public function crearFranja(int $id): void
    {
        $this->canchaPropia($id);
        $datos = leerJson();
        $desde = horaRequerida($datos, 'horaDesde', 'la hora de inicio');
        $hasta = horaRequerida($datos, 'horaHasta', 'la hora de fin', true);
        $precio = precioRequerido($datos, 'precio', 'el precio');

        if ($desde >= $hasta) {
            responder(400, ['error' => 'La hora de fin tiene que ser posterior a la de inicio']);
        }
        if ($this->franjas->seSuperpone($id, $desde, $hasta)) {
            responder(409, ['error' => 'Ese horario se superpone con otra franja de esta cancha']);
        }

        $franjaId = $this->franjas->crear($id, $desde, $hasta, $precio);
        responder(201, ['franja' => $this->franjas->publico($this->franjas->buscarPorId($franjaId))]);
    }

    // DELETE /franjas/:id
    public function borrarFranja(int $id): void
    {
        $this->verificarDueno($this->franjas->buscarConDueno($id), 'La franja');
        $this->franjas->borrar($id);
        responder(204);
    }

    private function complejoDelDueno(): array
    {
        $complejo = (new Complejo($this->pdo))->buscarPorUsuario($this->usuarioActual());
        if ($complejo === null) {
            responder(409, ['error' => 'Primero configurá los datos de tu complejo']);
        }
        return $complejo;
    }

    // Dos canchas con el mismo nombre se confundirían en la agenda
    private function verificarNombreLibre(int $complejoId, string $nombre, ?int $exceptoId = null): void
    {
        if ($this->canchas->nombreEnUso($complejoId, $nombre, $exceptoId)) {
            responder(409, ['error' => "Ya tenés una cancha llamada \"$nombre\""]);
        }
    }

    private function canchaPropia(int $id): array
    {
        return $this->verificarDueno($this->canchas->buscarConDueno($id), 'La cancha');
    }

    // 404 si no existe; 403 si es de otro dueño
    private function verificarDueno(?array $fila, string $que): array
    {
        if ($fila === null) {
            responder(404, ['error' => "$que no existe"]);
        }
        if ((int) $fila['usuario_id'] !== $this->usuarioActual()) {
            responder(403, ['error' => "$que no es de tu complejo"]);
        }
        return $fila;
    }

    private function datosValidos(array $datos): array
    {
        $deporte = (string) ($datos['deporte'] ?? '');
        if (!in_array($deporte, Cancha::DEPORTES, true)) {
            responder(400, ['error' => 'El deporte tiene que ser pádel o fútbol 5']);
        }
        $duracion = $datos['duracionMin'] ?? null;
        if (!in_array($duracion, Cancha::DURACIONES, true)) {
            responder(400, ['error' => 'La duración del turno tiene que ser de 60 o 90 minutos']);
        }

        $superficie = trim(textoDe($datos, 'superficie'));
        if (mb_strlen($superficie) > 50) {
            responder(400, ['error' => 'La superficie no puede superar los 50 caracteres']);
        }
        // (bool) "false" daría true: se exige un booleano de verdad
        $techada = $datos['techada'] ?? false;
        if (!is_bool($techada)) {
            responder(400, ['error' => 'Falta indicar si la cancha es techada']);
        }

        return [
            'nombre' => textoRequerido($datos, 'nombre', 50, 'el nombre de la cancha'),
            'deporte' => $deporte,
            'superficie' => $superficie !== '' ? $superficie : null,
            'techada' => $techada,
            'duracionMin' => $duracion,
            'precioBase' => precioRequerido($datos, 'precioBase', 'el precio del turno'),
        ];
    }
}
