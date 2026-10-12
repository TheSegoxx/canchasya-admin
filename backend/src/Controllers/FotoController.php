<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Cancha;
use App\Models\Foto;

/**
 * Endpoints /fotos: subir y borrar fotos del complejo y de las canchas.
 */
final class FotoController extends Controlador
{
    private const TAMANO_MAXIMO = 8 * 1024 * 1024; // 8 MB
    private const LADO_MAXIMO = 1600; // px, si el servidor tiene GD
    private const TIPOS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    private Foto $fotos;

    public function __construct()
    {
        parent::__construct();
        $this->fotos = new Foto($this->pdo);
    }

    /**
     * POST /fotos  (multipart/form-data)
     * Campo "foto" con la imagen; "canchaId" opcional (sin él, es una foto del complejo).
     */
    public function subir(): void
    {
        $complejoId = (int) $this->complejoDelDueno()['id'];

        $canchaId = null;
        if (($_POST['canchaId'] ?? '') !== '') {
            $id = filter_var($_POST['canchaId'], FILTER_VALIDATE_INT);
            if ($id === false) {
                responder(400, ['error' => 'La cancha no es válida']);
            }
            $canchaId = (int) $this->verificarDueno((new Cancha($this->pdo))->buscarConDueno($id), 'La cancha')['id'];
        }

        $maximo = $canchaId === null ? Foto::MAXIMO_COMPLEJO : Foto::MAXIMO_CANCHA;
        if ($this->fotos->contar($complejoId, $canchaId) >= $maximo) {
            responder(409, ['error' => "Se pueden cargar hasta $maximo fotos. Borrá alguna para subir otra."]);
        }

        $archivo = $this->guardarImagen($_FILES['foto'] ?? null);
        $id = $this->fotos->crear($complejoId, $canchaId, $archivo);
        responder(201, ['foto' => $this->fotos->publico($this->fotos->buscarPorId($id))]);
    }

    // DELETE /fotos/:id
    public function borrar(int $id): void
    {
        $foto = $this->verificarDueno($this->fotos->buscarConDueno($id), 'La foto');
        $this->fotos->borrar($id);
        $ruta = Foto::carpeta() . '/' . basename($foto['archivo']);
        if (is_file($ruta)) {
            unlink($ruta);
        }
        responder(204);
    }

    /**
     * Controla que sea de verdad una imagen (por su contenido, no por el nombre que
     * mandó el celular) y la guarda con un nombre aleatorio. Si PHP tiene GD, además
     * la achica y la vuelve a codificar: así se descartan los datos ocultos del archivo.
     */
    private function guardarImagen(mixed $subida): string
    {
        if (!is_array($subida) || !isset($subida['error']) || is_array($subida['error'])) {
            responder(400, ['error' => 'Falta la foto']);
        }
        if ($subida['error'] === UPLOAD_ERR_INI_SIZE || $subida['error'] === UPLOAD_ERR_FORM_SIZE
            || $subida['size'] > self::TAMANO_MAXIMO) {
            responder(413, ['error' => 'La foto es demasiado pesada (máximo 8 MB)']);
        }
        if ($subida['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($subida['tmp_name'])) {
            responder(400, ['error' => 'La foto no se pudo recibir. Probá de nuevo.']);
        }

        $tipo = (new \finfo(FILEINFO_MIME_TYPE))->file($subida['tmp_name']);
        $dimensiones = @getimagesize($subida['tmp_name']);
        if (!isset(self::TIPOS[$tipo]) || $dimensiones === false || $dimensiones[0] > 10000 || $dimensiones[1] > 10000) {
            responder(400, ['error' => 'El archivo no es una foto válida (JPG, PNG o WebP)']);
        }

        $carpeta = Foto::carpeta();
        if (!is_dir($carpeta)) {
            mkdir($carpeta, 0755, true);
        }
        $nombre = bin2hex(random_bytes(16));

        if (extension_loaded('gd')) {
            $archivo = "$nombre.jpg";
            $this->reducirConGd($subida['tmp_name'], $tipo, "$carpeta/$archivo");
        } else {
            $archivo = "$nombre." . self::TIPOS[$tipo];
            if (!move_uploaded_file($subida['tmp_name'], "$carpeta/$archivo")) {
                throw new \RuntimeException('No se pudo guardar la foto en ' . $carpeta);
            }
        }
        return $archivo;
    }

    private function reducirConGd(string $origen, string $tipo, string $destino): void
    {
        $imagen = match ($tipo) {
            'image/png' => imagecreatefrompng($origen),
            'image/webp' => imagecreatefromwebp($origen),
            default => imagecreatefromjpeg($origen),
        };
        if ($imagen === false) {
            responder(400, ['error' => 'El archivo no es una foto válida (JPG, PNG o WebP)']);
        }
        $ancho = imagesx($imagen);
        $alto = imagesy($imagen);
        $escala = min(1, self::LADO_MAXIMO / max($ancho, $alto));
        if ($escala < 1) {
            $imagen = imagescale($imagen, (int) round($ancho * $escala), (int) round($alto * $escala));
        }
        imagejpeg($imagen, $destino, 82);
    }
}
