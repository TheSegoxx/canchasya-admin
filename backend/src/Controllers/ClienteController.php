<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Cliente;

/**
 * Endpoints /clientes: buscar (para elegir al cargar un turno) y corregir datos.
 * Los clientes se crean solos al cargarles el primer turno.
 */
final class ClienteController extends Controlador
{
    private Cliente $clientes;

    public function __construct()
    {
        parent::__construct();
        $this->clientes = new Cliente($this->pdo);
    }

    // GET /clientes?buscar=texto  (por nombre o teléfono)
    public function listar(): void
    {
        $complejoId = (int) $this->complejoDelDueno()['id'];
        $buscar = $_GET['buscar'] ?? '';
        $texto = is_string($buscar) ? mb_substr(trim($buscar), 0, 100) : '';
        responder(200, [
            'clientes' => array_map([$this->clientes, 'publico'], $this->clientes->buscar($complejoId, $texto)),
        ]);
    }

    // PUT /clientes/:id  {nombre, telefono}
    public function editar(int $id): void
    {
        $cliente = $this->verificarDueno($this->clientes->buscarConDueno($id), 'El cliente');
        $datos = leerJson();
        $nombre = textoRequerido($datos, 'nombre', 100, 'el nombre');
        $telefono = normalizarTelefono(textoDe($datos, 'telefono'));
        if ($telefono === null) {
            responder(400, ['error' => 'El teléfono no es válido. Escribilo con el código de área (por ejemplo, 11 5555 1234).']);
        }

        $otro = $this->clientes->buscarPorTelefono((int) $cliente['complejo_id'], $telefono);
        if ($otro !== null && (int) $otro['id'] !== $id) {
            responder(409, ['error' => "Ese teléfono ya es de otro cliente ({$otro['nombre']})"]);
        }

        $this->clientes->editar($id, $nombre, $telefono);
        responder(200, ['cliente' => $this->clientes->publico($this->clientes->buscarPorId($id))]);
    }
}
