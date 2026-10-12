<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Producto;

/**
 * Endpoints /productos: catálogo de extras del complejo.
 */
final class ProductoController extends Controlador
{
    private Producto $productos;

    public function __construct()
    {
        parent::__construct();
        $this->productos = new Producto($this->pdo);
    }

    // GET /productos  (activos primero)
    public function listar(): void
    {
        $complejoId = (int) $this->complejoDelDueno()['id'];
        responder(200, ['productos' => array_map([$this->productos, 'publico'], $this->productos->listarPorComplejo($complejoId))]);
    }

    // POST /productos  {nombre, precio}
    public function crear(): void
    {
        $complejoId = (int) $this->complejoDelDueno()['id'];
        $datos = leerJson();
        $nombre = textoRequerido($datos, 'nombre', Producto::NOMBRE_MAXIMO, 'el nombre');
        $precio = precioRequerido($datos, 'precio', 'el precio');
        $this->verificarNombreLibre($complejoId, $nombre);
        $id = $this->productos->crear($complejoId, $nombre, $precio);
        responder(201, ['producto' => $this->productos->publico($this->productos->buscarPorId($id))]);
    }

    // PUT /productos/:id  {nombre, precio, activo}
    public function editar(int $id): void
    {
        $producto = $this->verificarDueno($this->productos->buscarConDueno($id), 'El producto');
        $datos = leerJson();
        $nombre = textoRequerido($datos, 'nombre', Producto::NOMBRE_MAXIMO, 'el nombre');
        $precio = precioRequerido($datos, 'precio', 'el precio');
        $activo = $datos['activo'] ?? true;
        if (!is_bool($activo)) {
            responder(400, ['error' => 'Falta indicar si el producto está activo']);
        }
        $this->verificarNombreLibre((int) $producto['complejo_id'], $nombre, $id);
        $this->productos->editar($id, $nombre, $precio, $activo);
        responder(200, ['producto' => $this->productos->publico($this->productos->buscarPorId($id))]);
    }

    private function verificarNombreLibre(int $complejoId, string $nombre, ?int $exceptoId = null): void
    {
        if ($this->productos->nombreEnUso($complejoId, $nombre, $exceptoId)) {
            responder(409, ['error' => "Ya tenés un producto llamado \"$nombre\""]);
        }
    }
}
