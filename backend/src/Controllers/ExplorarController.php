<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Cancha;
use App\Models\Complejo;
use App\Models\Favorito;
use App\Models\Foto;
use App\Models\FranjaPrecio;
use App\Services\Clima;
use App\Services\Fidelidad;
use PDO;

/**
 * Endpoints /complejos: lo que ve el jugador para elegir dónde jugar.
 * Solo aparecen los complejos visibles que tienen al menos una cancha habilitada.
 * Nunca se muestran datos del dueño ni de la gestión (caja, clientes, turnos).
 */
final class ExplorarController extends Controlador
{
    private Complejo $complejos;
    private Favorito $favoritos;

    public function __construct()
    {
        parent::__construct();
        $this->complejos = new Complejo($this->pdo);
        $this->favoritos = new Favorito($this->pdo);
    }

    /**
     * GET /complejos?buscar=texto&deporte=padel&favoritos=1&lat=-31.4&lng=-64.1
     * Con lat y lng se ordenan por distancia (los que no cargaron su ubicación, al final).
     */
    public function listar(): void
    {
        $usuarioId = $this->usuarioActual();
        $deporte = $_GET['deporte'] ?? '';
        if ($deporte !== '' && !in_array($deporte, Cancha::DEPORTES, true)) {
            responder(400, ['error' => 'El deporte no es válido']);
        }
        $buscar = trim((string) ($_GET['buscar'] ?? ''));
        if (mb_strlen($buscar) > 60) {
            responder(400, ['error' => 'La búsqueda es demasiado larga']);
        }
        $desde = $this->coordenadas();
        $favoritos = $this->favoritos->idsDe($usuarioId);
        if (($_GET['favoritos'] ?? '') === '1' && $favoritos === []) {
            responder(200, ['complejos' => []]);
        }

        $condiciones = ['x.visible = 1'];
        $valores = [];
        if ($buscar !== '') {
            // Busca en el nombre, la dirección y la ciudad
            $condiciones[] = '(x.nombre LIKE ? OR x.direccion LIKE ? OR x.ciudad LIKE ?)';
            $patron = '%' . addcslashes($buscar, '%_\\') . '%';
            array_push($valores, $patron, $patron, $patron);
        }
        if (($_GET['favoritos'] ?? '') === '1') {
            $condiciones[] = 'x.id IN (' . implode(',', array_fill(0, count($favoritos), '?')) . ')';
            array_push($valores, ...$favoritos);
        }
        $stmt = $this->pdo->prepare('SELECT x.* FROM complejos x WHERE ' . implode(' AND ', $condiciones));
        $stmt->execute($valores);
        $complejos = $stmt->fetchAll();

        $canchas = $this->canchasHabilitadas(array_column($complejos, 'id'));
        $portadas = $this->portadas(array_column($complejos, 'id'));
        $resultado = [];
        foreach ($complejos as $complejo) {
            $propias = $canchas[$complejo['id']] ?? [];
            $deportes = array_values(array_unique(array_column($propias, 'deporte')));
            // Sin canchas habilitadas (o sin el deporte buscado) no aparece
            if ($propias === [] || ($deporte !== '' && !in_array($deporte, $deportes, true))) {
                continue;
            }
            $delDeporte = $deporte === '' ? $propias : array_filter($propias, fn (array $c) => $c['deporte'] === $deporte);
            $ubicacion = Complejo::ubicacion($complejo);
            $resultado[] = [
                'id' => (int) $complejo['id'],
                'nombre' => $complejo['nombre'],
                'direccion' => $complejo['direccion'],
                'ciudad' => $complejo['ciudad'],
                'ubicacion' => $ubicacion,
                'distanciaKm' => $desde !== null && $ubicacion !== null ? round(self::distanciaKm($desde, $ubicacion), 1) : null,
                'foto' => isset($portadas[$complejo['id']]) ? 'fotos/' . $portadas[$complejo['id']] : null,
                'deportes' => $deportes,
                'canchas' => count($propias),
                // El precio más bajo por hora (de las canchas del deporte buscado)
                'precioHoraDesde' => min(array_map(fn (array $c) => $c['precioHoraMinimo'], $delDeporte)),
                'horaApertura' => substr($complejo['hora_apertura'], 0, 5),
                'horaCierre' => substr($complejo['hora_cierre'], 0, 5),
                'favorito' => in_array((int) $complejo['id'], $favoritos, true),
            ];
        }

        usort($resultado, function (array $a, array $b) {
            if ($a['distanciaKm'] !== $b['distanciaKm']) {
                // Los que no tienen distancia van al final
                return ($a['distanciaKm'] ?? INF) <=> ($b['distanciaKm'] ?? INF);
            }
            return strcasecmp($a['nombre'], $b['nombre']);
        });
        responder(200, ['complejos' => $resultado]);
    }

    // GET /complejos/:id  La ficha: fotos, horario, servicios, contacto y canchas con sus precios
    public function obtener(int $id): void
    {
        $usuarioId = $this->usuarioActual();
        $complejo = $this->complejos->buscarPorId($id);
        $canchas = $this->canchasHabilitadas([$id])[$id] ?? [];
        if ($complejo === null || !$complejo['visible'] || $canchas === []) {
            responder(404, ['error' => 'Ese complejo no existe o ya no está en CanchasYa']);
        }

        $fotos = new Foto($this->pdo);
        $publico = $this->complejos->publico($complejo);
        responder(200, [
            'complejo' => [
                'id' => $publico['id'],
                'nombre' => $publico['nombre'],
                'direccion' => $publico['direccion'],
                'ciudad' => $publico['ciudad'],
                'ubicacion' => $publico['ubicacion'],
                'telefono' => $publico['telefono'],
                'horaApertura' => $publico['horaApertura'],
                'horaCierre' => $publico['horaCierre'],
                'servicios' => $publico['servicios'],
                'fotos' => array_map(fn (array $f) => $fotos->publico($f)['ruta'], $fotos->listar($id)),
                'favorito' => in_array($id, $this->favoritos->idsDe($usuarioId), true),
                // Si toma reservas por la app, la seña y los plazos
                'reservas' => $publico['reservas'],
                // Los sellos del jugador (null si el complejo no tiene programa de fidelidad)
                'fidelidad' => (new Fidelidad($this->pdo))->de($usuarioId, $complejo),
                'canchas' => array_map(fn (array $c) => [
                    'id' => (int) $c['id'],
                    'nombre' => $c['nombre'],
                    'deporte' => $c['deporte'],
                    'superficie' => $c['superficie'],
                    'techada' => (bool) $c['techada'],
                    'duracionMin' => (int) $c['duracion_min'],
                    'precioBase' => (float) $c['precio_base'],
                    'franjas' => $c['franjas'],
                    'fotos' => array_map(fn (array $f) => $fotos->publico($f)['ruta'], $fotos->listar($id, (int) $c['id'])),
                ], $canchas),
            ],
        ]);
    }

    /**
     * GET /complejos/:id/clima?fecha=AAAA-MM-DD
     * El pronóstico por hora de ese día (vacío si el complejo no cargó su ubicación o falta mucho).
     */
    public function clima(int $id): void
    {
        $this->usuarioActual();
        $complejo = $this->complejos->buscarPorId($id);
        if ($complejo === null || !$complejo['visible']) {
            responder(404, ['error' => 'Ese complejo no existe o ya no está en CanchasYa']);
        }
        $fecha = $_GET['fecha'] ?? hoy();
        if (!is_string($fecha) || !fechaValida($fecha)) {
            responder(400, ['error' => 'La fecha tiene que tener el formato AAAA-MM-DD']);
        }
        responder(200, ['fecha' => $fecha, 'horas' => (new Clima($this->pdo))->delDia($complejo, $fecha)]);
    }

    // PUT /complejos/:id/favorito
    public function agregarFavorito(int $id): void
    {
        $usuarioId = $this->usuarioActual();
        $complejo = $this->complejos->buscarPorId($id);
        if ($complejo === null || !$complejo['visible']) {
            responder(404, ['error' => 'Ese complejo no existe o ya no está en CanchasYa']);
        }
        $this->favoritos->agregar($usuarioId, $id);
        responder(200, ['favorito' => true]);
    }

    // DELETE /complejos/:id/favorito
    public function quitarFavorito(int $id): void
    {
        $this->favoritos->quitar($this->usuarioActual(), $id);
        responder(200, ['favorito' => false]);
    }

    /**
     * Canchas habilitadas de esos complejos, con sus franjas y el precio por hora más bajo.
     *
     * @param list<int|string> $complejoIds
     * @return array<int, list<array>> [complejoId => canchas]
     */
    private function canchasHabilitadas(array $complejoIds): array
    {
        if ($complejoIds === []) {
            return [];
        }
        $marcas = implode(',', array_fill(0, count($complejoIds), '?'));
        $stmt = $this->pdo->prepare(
            "SELECT * FROM canchas WHERE habilitada = 1 AND complejo_id IN ($marcas) ORDER BY deporte, nombre"
        );
        $stmt->execute(array_values($complejoIds));
        $canchas = $stmt->fetchAll();

        $franjas = [];
        if ($canchas !== []) {
            $marcasCanchas = implode(',', array_fill(0, count($canchas), '?'));
            $consulta = $this->pdo->prepare(
                "SELECT * FROM franjas_precio WHERE cancha_id IN ($marcasCanchas) ORDER BY hora_desde"
            );
            $consulta->execute(array_column($canchas, 'id'));
            $modelo = new FranjaPrecio($this->pdo);
            foreach ($consulta->fetchAll() as $f) {
                $franjas[$f['cancha_id']][] = $modelo->publico($f);
            }
        }

        $porComplejo = [];
        foreach ($canchas as $c) {
            $c['franjas'] = $franjas[$c['id']] ?? [];
            $precios = [(float) $c['precio_base'], ...array_column($c['franjas'], 'precio')];
            // Los precios son por turno (lo que dura la cancha): se pasan a la hora para comparar
            $c['precioHoraMinimo'] = round(min($precios) * 60 / (int) $c['duracion_min']);
            $porComplejo[(int) $c['complejo_id']][] = $c;
        }
        return $porComplejo;
    }

    /**
     * Primera foto del complejo (o, si no tiene, de alguna de sus canchas).
     *
     * @param list<int|string> $complejoIds
     * @return array<int, string> [complejoId => archivo]
     */
    private function portadas(array $complejoIds): array
    {
        if ($complejoIds === []) {
            return [];
        }
        $marcas = implode(',', array_fill(0, count($complejoIds), '?'));
        $stmt = $this->pdo->prepare(
            "SELECT complejo_id, archivo FROM fotos WHERE complejo_id IN ($marcas)
             ORDER BY complejo_id, cancha_id IS NOT NULL, id"
        );
        $stmt->execute(array_values($complejoIds));
        $portadas = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $f) {
            $portadas[(int) $f['complejo_id']] ??= $f['archivo'];
        }
        return $portadas;
    }

    /** @return array{latitud: float, longitud: float}|null las de ?lat=&lng= (desde dónde busca el jugador) */
    private function coordenadas(): ?array
    {
        if (!isset($_GET['lat'], $_GET['lng'])) {
            return null;
        }
        $lat = filter_var($_GET['lat'], FILTER_VALIDATE_FLOAT);
        $lng = filter_var($_GET['lng'], FILTER_VALIDATE_FLOAT);
        if ($lat === false || $lng === false || abs($lat) > 90 || abs($lng) > 180) {
            responder(400, ['error' => 'La ubicación no es válida']);
        }
        return ['latitud' => $lat, 'longitud' => $lng];
    }

    // Distancia en línea recta (fórmula del haversine)
    private static function distanciaKm(array $a, array $b): float
    {
        $radianes = fn (float $grados) => $grados * M_PI / 180;
        $dLat = $radianes($b['latitud'] - $a['latitud']);
        $dLng = $radianes($b['longitud'] - $a['longitud']);
        $h = sin($dLat / 2) ** 2 + cos($radianes($a['latitud'])) * cos($radianes($b['latitud'])) * sin($dLng / 2) ** 2;
        return 6371 * 2 * asin(min(1, sqrt($h)));
    }
}
