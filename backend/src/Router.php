<?php

declare(strict_types=1);

namespace App;

/**
 * Router simple: asocia método HTTP + ruta con una acción.
 * Las rutas pueden tener parámetros numéricos, por ejemplo /canchas/:id
 */
final class Router
{
    /** @var array<int, array{metodo: string, regex: string, accion: callable}> */
    private array $rutas = [];

    public function agregar(string $metodo, string $patron, callable $accion): void
    {
        // "/canchas/:id/estado" -> "#^/canchas/(?P<id>\d+)/estado$#"
        $regex = '#^' . preg_replace('#:([a-zA-Z]+)#', '(?P<$1>\d+)', $patron) . '$#';
        $this->rutas[] = ['metodo' => $metodo, 'regex' => $regex, 'accion' => $accion];
    }

    public function despachar(string $metodo, string $uri): void
    {
        $ruta = $this->rutaRelativa($uri);
        $existeConOtroMetodo = false;

        foreach ($this->rutas as $r) {
            if (!preg_match($r['regex'], $ruta, $coincidencias)) {
                continue;
            }
            if ($r['metodo'] !== $metodo) {
                $existeConOtroMetodo = true;
                continue;
            }
            // Solo los parámetros con nombre (id, etc.), convertidos a entero
            $parametros = array_map('intval', array_filter($coincidencias, 'is_string', ARRAY_FILTER_USE_KEY));
            ($r['accion'])($parametros);
            return;
        }

        if ($existeConOtroMetodo) {
            responder(405, ['error' => 'Método no permitido para esta ruta']);
        }
        responder(404, ['error' => 'Ruta no encontrada']);
    }

    // "/canchero/api/auth/login?x=1" -> "/auth/login"
    private function rutaRelativa(string $uri): string
    {
        $ruta = parse_url($uri, PHP_URL_PATH) ?: '/';
        $posicion = strpos($ruta, '/api/');
        if ($posicion !== false) {
            $ruta = substr($ruta, $posicion + 4);
        }
        return rtrim($ruta, '/') ?: '/';
    }
}
