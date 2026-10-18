<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ErrorHttp;
use App\Models\Bloqueo;
use App\Models\Cancha;
use App\Models\Cliente;
use App\Models\Complejo;
use App\Models\LinkPago;
use App\Models\PartidoAbierto;
use App\Models\Turno;
use App\Models\Usuario;
use App\Models\VaquitaParte;
use App\Services\AgendaService;
use App\Services\CobroService;
use App\Services\Fidelidad;
use App\Services\LinksDePago;
use App\Services\ListaEspera;
use App\Services\MercadoPago;
use App\Services\Notificaciones;
use App\Services\Reservas;
use Throwable;

/**
 * Lo que hace el jugador para jugar: ver los horarios libres, reservar (eligiendo cuánto juega),
 * pagar la seña o el total por Mercado Pago, dividirlo con los amigos (la vaquita), ver sus
 * reservas y cancelarlas.
 * Al jugador nunca se le muestran datos de otros clientes (un horario ocupado es solo "ocupado").
 */
final class ReservaController extends Controlador
{
    // Los turnos empiezan en punto o y media, como en la agenda del complejo
    private const PASO_MINUTOS = 30;
    private const DURACION_MAXIMA = 240;
    // Reservas futuras sin ningún pago que puede tener a la vez un jugador
    private const MAXIMO_SIN_PAGAR = 3;
    private const PAGOS = ['sena', 'total', 'complejo'];

    private Turno $turnos;
    private Cancha $canchas;
    private Complejo $complejos;
    private LinkPago $links;
    private VaquitaParte $vaquita;
    private AgendaService $agenda;
    private Reservas $reservas;

    public function __construct()
    {
        parent::__construct();
        $this->turnos = new Turno($this->pdo);
        $this->canchas = new Cancha($this->pdo);
        $this->complejos = new Complejo($this->pdo);
        $this->links = new LinkPago($this->pdo);
        $this->vaquita = new VaquitaParte($this->pdo);
        $this->agenda = new AgendaService($this->pdo);
        $this->reservas = new Reservas($this->pdo);
    }

    /**
     * GET /complejos/:id/disponibilidad?fecha=AAAA-MM-DD  (sin fecha: hoy)
     * Los horarios ocupados de cada cancha ese día y las reglas para reservar.
     * Con las canchas y sus precios de la ficha, la app arma los horarios libres.
     */
    public function disponibilidad(int $complejoId): void
    {
        $this->usuarioActual();
        $complejo = $this->complejoQueReserva($complejoId);
        $reglas = Complejo::reglasReservas($complejo);
        $fecha = $_GET['fecha'] ?? hoy();
        if (!is_string($fecha) || !fechaValida($fecha)) {
            responder(400, ['error' => 'La fecha tiene que tener el formato AAAA-MM-DD']);
        }
        $this->validarFecha($complejo, $fecha);

        $this->reservas->liberarVencidas($complejoId);
        $this->transaccion(fn () => $this->agenda->materializarFijos($complejoId, $fecha));

        $ocupados = [];
        foreach ($this->turnos->listarPorFecha($complejoId, $fecha) as $t) {
            if ($t['estado'] !== 'cancelado') {
                $ocupados[] = ['canchaId' => (int) $t['cancha_id'], 'horaDesde' => horaCorta($t['hora_inicio']), 'horaHasta' => horaCorta($t['hora_fin'])];
            }
        }
        $bloqueos = new Bloqueo($this->pdo);
        foreach ($bloqueos->listarPorFecha($complejoId, $fecha) as $b) {
            $publico = $bloqueos->publico($b, $fecha);
            $ocupados[] = ['canchaId' => $publico['canchaId'], 'horaDesde' => $publico['horaDesde'], 'horaHasta' => $publico['horaHasta']];
        }

        responder(200, [
            'fecha' => $fecha,
            'horaApertura' => horaCorta($complejo['hora_apertura']),
            'horaCierre' => horaCorta($complejo['hora_cierre']),
            // Si es hoy, los horarios que ya empezaron no se pueden reservar
            'ahora' => $fecha === hoy() ? date('H:i') : null,
            'reservas' => $reglas,
            'ocupados' => $ocupados,
        ]);
    }

    /**
     * POST /reservas  {canchaId, fecha, horaInicio, duracionMin, pago: "sena"|"total"|"complejo", telefono?, usarPremio?}
     * Con seña, la reserva se cancela sola si no se paga a tiempo. Si se elige pagar por
     * Mercado Pago, la respuesta trae el link. Con usarPremio se aplica un premio de fidelidad.
     */
    public function crear(): void
    {
        $this->soloJugador();
        $usuarioId = $this->usuarioActual();
        $datos = leerJson();

        $cancha = $this->canchas->buscarPorId(idRequerido($datos, 'canchaId', 'la cancha'));
        if ($cancha === null || !$cancha['habilitada']) {
            responder(404, ['error' => 'Esa cancha no existe o ya no se puede reservar']);
        }
        $canchaId = (int) $cancha['id'];
        $complejo = $this->complejoQueReserva((int) $cancha['complejo_id']);
        $complejoId = (int) $complejo['id'];
        $reglas = Complejo::reglasReservas($complejo);
        if (!$reglas['aceptaReservas']) {
            responder(409, ['error' => 'Este complejo no toma reservas por la app. Escribiles o llamalos para reservar.']);
        }

        $fecha = fechaRequerida($datos, 'fecha', 'el día');
        $this->validarFecha($complejo, $fecha);
        $inicio = horaRequerida($datos, 'horaInicio', 'la hora');
        if (minutosDe($inicio) % self::PASO_MINUTOS !== 0) {
            responder(400, ['error' => 'Los turnos empiezan en punto o y media']);
        }
        $duracion = $this->duracion($datos, $cancha);
        $fin = minutosDe($inicio) + $duracion;
        if ($inicio < $complejo['hora_apertura'] || $fin > minutosDe($complejo['hora_cierre'])) {
            responder(400, ['error' => sprintf(
                'Jugando %s desde esa hora te pasás del horario del complejo (%s a %s)',
                duracionVisible($duracion),
                horaCorta($complejo['hora_apertura']),
                horaCorta($complejo['hora_cierre'])
            )]);
        }
        $fin = horaDe($fin);
        if ($fecha === hoy() && $inicio <= date('H:i:s')) {
            responder(409, ['error' => 'Ese horario ya empezó. Elegí uno más tarde.']);
        }

        $pago = textoDe($datos, 'pago');
        $permitidos = $reglas['senaPorcentaje'] > 0 ? ['sena', 'total'] : ['complejo', 'total'];
        if (!in_array($pago, self::PAGOS, true) || !in_array($pago, $permitidos, true)) {
            responder(400, ['error' => $reglas['senaPorcentaje'] > 0
                ? 'Este complejo pide seña: elegí pagar la seña o el total'
                : 'Elegí pagar en el complejo o pagar el total ahora']);
        }
        $usarPremio = booleanoOpcional($datos, 'usarPremio', 'usarPremio');
        $fidelidad = $usarPremio ? (new Fidelidad($this->pdo))->de($usuarioId, $complejo) : null;
        if ($usarPremio && ($fidelidad === null || $fidelidad['premios'] < 1)) {
            responder(409, ['error' => 'No tenés un premio de fidelidad para usar en este complejo']);
        }
        $telefono = $this->telefonoDelJugador($datos);
        if ($this->turnos->reservasSinPagar($usuarioId) >= self::MAXIMO_SIN_PAGAR) {
            responder(409, ['error' => 'Ya tenés ' . self::MAXIMO_SIN_PAGAR . ' reservas sin pagar. Pagá o cancelá alguna antes de hacer otra.']);
        }

        // Si una seña venció, ese horario se libera antes de controlar si está ocupado
        $this->reservas->liberarVencidas($complejoId);
        $precio = $this->agenda->precioPorTramos($cancha, $inicio, $fin);
        // El premio de fidelidad descuenta un porcentaje (100 = gratis)
        $descuento = $fidelidad !== null ? round($precio * $fidelidad['descuento'] / 100) : 0.0;
        $precio -= $descuento;
        $sena = Reservas::montoSena($precio, $reglas['senaPorcentaje']);
        $nombre = $this->usuario()['nombre'];

        $id = $this->transaccion(function () use ($complejoId, $canchaId, $fecha, $inicio, $fin, $precio, $descuento, $sena, $reglas, $nombre, $telefono, $usuarioId) {
            $this->agenda->trabarCancha($canchaId);
            $this->agenda->materializarFijos($complejoId, $fecha, $canchaId);
            // Sin decir de quién es: es el turno de otro cliente
            if ($this->agenda->conflicto($canchaId, $fecha, $inicio, $fin) !== null) {
                throw new ErrorHttp(409, 'Ese horario se acaba de ocupar. Elegí otro.');
            }
            $id = $this->turnos->crear([
                'canchaId' => $canchaId,
                'clienteId' => (new Cliente($this->pdo))->obtenerOCrear($complejoId, $nombre, $telefono),
                'turnoFijoId' => null,
                'usuarioId' => $usuarioId,
                'fecha' => $fecha,
                'horaInicio' => $inicio,
                'horaFin' => $fin,
                'precio' => $precio,
                'sena' => $sena,
                'senaVenceEn' => $sena !== null ? Reservas::venceSena($fecha, $inicio, $reglas['senaMinutos']) : null,
                'descuento' => $descuento,
            ]);
            // Una cancha sin cargo queda pagada desde el principio
            (new CobroService($this->pdo))->actualizarEstadoPago($id);
            return $id;
        });

        $reserva = $this->turnos->buscarReserva($id);
        $this->avisarAlComplejo('Nueva reserva desde la app', $reserva, sprintf(
            '%s · %s, %s (%s)%s',
            $reserva['cliente_nombre'],
            $reserva['cancha_nombre'],
            Notificaciones::cuando($fecha, $inicio),
            duracionVisible($duracion),
            ($sena !== null ? ' · Seña de ' . pesos($sena) . ' pendiente' : '') . ($descuento > 0 ? ' · Usó un premio de fidelidad' : '')
        ));

        $respuesta = [];
        // Gratis con el premio: no hay nada que pagar
        if ($pago !== 'complejo' && $precio > 0) {
            try {
                $respuesta['link'] = $this->linkDePago($reserva, $pago === 'sena' ? 'sena' : 'saldo');
            } catch (Throwable $e) {
                error_log('[CanchasYa API] No se pudo crear el link de la reserva ' . $id . ': ' . $e->getMessage());
                $respuesta['aviso'] = 'La reserva quedó hecha, pero no se pudo generar el link de Mercado Pago. '
                    . 'Probá pagar de nuevo desde Mis reservas.';
            }
        }
        responder(201, ['reserva' => $this->publica($this->turnos->buscarReserva($id)), ...$respuesta]);
    }

    // GET /reservas  Las próximas (de la más cercana a la más lejana) y las anteriores
    public function listar(): void
    {
        $this->soloJugador();
        $usuarioId = $this->usuarioActual();
        $this->reservas->liberarVencidas(null, $usuarioId);

        $proximas = [];
        $anteriores = [];
        foreach ($this->turnos->listarDelJugador($usuarioId) as $fila) {
            $reserva = $this->publica($fila);
            if ($reserva['estado'] === 'confirmado' && !$reserva['terminada']) {
                $proximas[] = $reserva;
            } else {
                $anteriores[] = $reserva;
            }
        }
        responder(200, ['proximas' => array_reverse($proximas), 'anteriores' => $anteriores]);
    }

    // GET /reservas/:id
    public function obtener(int $id): void
    {
        $this->reservaDelJugador($id);
        $this->reservas->liberarVencidas(null, $this->usuarioActual());
        responder(200, ['reserva' => $this->publica($this->turnos->buscarReserva($id))]);
    }

    /**
     * POST /reservas/:id/pago  {que: "sena"|"saldo"}
     * El link de Mercado Pago para pagar la seña o todo lo que falta.
     */
    public function pagar(int $id): void
    {
        $reserva = $this->reservaDelJugador($id);
        $que = textoDe(leerJson(), 'que');
        if (!in_array($que, ['sena', 'saldo'], true)) {
            responder(400, ['error' => 'Elegí si pagás la seña o el total']);
        }
        if ($que === 'sena' && !Turno::senaPendiente($reserva)) {
            responder(409, ['error' => 'Esta reserva no tiene una seña pendiente']);
        }
        if ($this->publica($reserva)['vaquitaEnMarcha']) {
            responder(409, ['error' => 'Hay una vaquita en marcha: pagá tu parte desde la vaquita o deshacela.']);
        }
        $link = $this->linkDePago($reserva, $que);
        responder(200, ['link' => $link, 'reserva' => $this->publica($this->turnos->buscarReserva($id))]);
    }

    // POST /reservas/:id/verificar-pago  (al volver de Mercado Pago)
    public function verificarPago(int $id): void
    {
        $this->reservaDelJugador($id);
        $pagado = $this->reservas->verificarLinks([$id]);
        responder(200, ['pagado' => $pagado, 'reserva' => $this->publica($this->turnos->buscarReserva($id))]);
    }

    /**
     * POST /reservas/:id/vaquita  {partes: [{nombre}, ...]}  (la primera es la del jugador que reservó)
     * Divide lo que falta pagar entre 2 y 10 personas; cada una recibe su link de Mercado Pago.
     * Si había otros links esperando el pago, se anulan (los reemplaza la vaquita).
     */
    public function armarVaquita(int $id): void
    {
        $reserva = $this->reservaDelJugador($id);
        $nombres = $this->nombresDeLaVaquita(leerJson()['partes'] ?? null);
        if ($reserva['estado'] !== 'confirmado' || $this->publica($reserva)['terminada']) {
            responder(409, ['error' => 'La vaquita se arma para una reserva confirmada que todavía no se jugó']);
        }
        // Primero se mira si entró algún pago, así no se divide de más
        $this->reservas->verificarLinks([$id]);
        if ($this->publica($this->turnos->buscarReserva($id))['vaquitaEnMarcha']) {
            responder(409, ['error' => 'Ya hay una vaquita en marcha. Deshacela para armar otra.']);
        }
        $saldo = (new CobroService($this->pdo))->cuenta($id)['saldo'];
        if ($saldo < count($nombres)) {
            responder(409, ['error' => $saldo > 0 ? 'Lo que falta pagar es muy poco para dividirlo' : 'Esta reserva ya está pagada']);
        }

        // Los links que esperaban el pago (la seña, el total) los reemplaza la vaquita
        $links = new LinksDePago($this->pdo);
        $links->anular(array_map(fn (array $l) => (int) $l['id'], $this->links->pendientesDelTurno($id)));
        if ($this->links->pendientesDelTurno($id) !== []) {
            responder(502, ['error' => 'No se pudo anular el link de pago anterior en Mercado Pago. Probá de nuevo en un rato.']);
        }

        $montos = VaquitaParte::dividir($saldo, count($nombres));
        $partes = $this->transaccion(function () use ($id, $nombres, $montos) {
            $ids = [];
            foreach ($nombres as $i => $nombre) {
                $ids[] = $this->vaquita->crear($id, $nombre, $montos[$i], $i === 0);
            }
            return $ids;
        });

        // Los links vencen cuando termina el turno (si la seña no se completa, se anulan al cancelarse)
        $vence = AgendaService::rango($reserva['fecha'], $reserva['hora_inicio'], $reserva['hora_fin'])[1];
        try {
            $mercadoPago = new MercadoPago();
            foreach ($partes as $i => $parteId) {
                $link = $links->crear($reserva, $montos[$i], $vence, $mercadoPago, $nombres[$i]);
                $this->vaquita->asignarLink($parteId, (int) $link['id']);
            }
        } catch (Throwable $e) {
            // Se deshace lo que se alcanzó a crear
            $links->anular($this->vaquita->anularSinPagar($id));
            throw $e;
        }
        responder(201, ['reserva' => $this->publica($this->turnos->buscarReserva($id))]);
    }

    // DELETE /reservas/:id/vaquita  Anula las partes que no se pagaron (las pagadas quedan)
    public function deshacerVaquita(int $id): void
    {
        $this->reservaDelJugador($id);
        // Antes se registra lo que se haya pagado recién
        $this->reservas->verificarLinks([$id]);
        $links = $this->transaccion(fn () => $this->vaquita->anularSinPagar($id));
        (new LinksDePago($this->pdo))->anular($links);
        responder(200, ['reserva' => $this->publica($this->turnos->buscarReserva($id))]);
    }

    /**
     * PUT /reservas/:id/me-falta-uno  {faltan, nivel, comentario?}
     * Publica (o actualiza) que el partido busca jugadores; aparece en "Partidos" para los demás.
     */
    public function publicarMeFaltaUno(int $id): void
    {
        $reserva = $this->reservaDelJugador($id);
        if ($reserva['estado'] !== 'confirmado' || strtotime("{$reserva['fecha']} {$reserva['hora_inicio']}") <= time()) {
            responder(409, ['error' => 'Solo se buscan jugadores para una reserva confirmada que todavía no empezó']);
        }
        $datos = leerJson();
        $faltan = $datos['faltan'] ?? null;
        if (!is_int($faltan) || $faltan < 1 || $faltan > 9) {
            responder(400, ['error' => 'Pueden faltar de 1 a 9 jugadores']);
        }
        $nivel = textoDe($datos, 'nivel') ?: 'cualquiera';
        if (!in_array($nivel, PartidoAbierto::NIVELES, true)) {
            responder(400, ['error' => 'El nivel no es válido']);
        }
        $comentario = trim(textoDe($datos, 'comentario'));
        if (mb_strlen($comentario) > 140) {
            responder(400, ['error' => 'El comentario puede tener hasta 140 letras']);
        }
        $partidos = new PartidoAbierto($this->pdo);
        $actual = $partidos->buscarPorTurno($id);
        if ($actual !== null && $faltan < count($partidos->jugadores((int) $actual['id']))) {
            responder(409, ['error' => 'Ya se sumaron más jugadores que esos']);
        }
        $partidos->publicar($id, $faltan, $nivel, $comentario !== '' ? $comentario : null);
        responder(200, ['reserva' => $this->publica($this->turnos->buscarReserva($id))]);
    }

    // DELETE /reservas/:id/me-falta-uno  Deja de buscar (los que se sumaron siguen)
    public function cerrarMeFaltaUno(int $id): void
    {
        $this->reservaDelJugador($id);
        (new PartidoAbierto($this->pdo))->cerrar($id);
        responder(200, ['reserva' => $this->publica($this->turnos->buscarReserva($id))]);
    }

    /**
     * POST /reservas/:id/cancelar
     * Hasta las horas antes que fija el complejo; mientras la seña está pendiente, en cualquier momento.
     * Si había pagado algo, se le avisa al complejo para que lo devuelva.
     */
    public function cancelar(int $id): void
    {
        $reserva = $this->reservaDelJugador($id);
        $datos = $this->publica($reserva);
        if ($reserva['estado'] !== 'confirmado') {
            responder(409, ['error' => $reserva['estado'] === 'cancelado' ? 'Esta reserva ya estaba cancelada' : 'Esta reserva ya se jugó']);
        }
        if (!$datos['puedeCancelar']) {
            responder(409, ['error' => strtotime("{$reserva['fecha']} {$reserva['hora_inicio']}") <= time()
                ? 'La reserva ya empezó: no se puede cancelar.'
                : sprintf(
                    'Este complejo permite cancelar hasta %s antes. Escribiles para ver si pueden cambiarla.',
                    $reserva['cancelacion_horas'] == 1 ? '1 hora' : "{$reserva['cancelacion_horas']} horas"
                )]);
        }

        $this->transaccion(function () use ($id) {
            if ($this->turnos->trabar($id)['estado'] !== 'confirmado') {
                throw new ErrorHttp(409, 'Esta reserva ya no está confirmada');
            }
            $this->turnos->cambiarEstado($id, 'cancelado');
        });
        (new LinksDePago($this->pdo))->anularDeTurnosCancelados([$id]);
        // Si alguien esperaba ese horario, se le avisa
        (new ListaEspera($this->pdo))->revisar((int) $reserva['cancha_id']);

        $pagado = (float) $reserva['pagado'];
        $this->avisarAlComplejo('Reserva cancelada por el jugador', $reserva, sprintf(
            '%s canceló · %s, %s%s',
            $reserva['cliente_nombre'],
            $reserva['cancha_nombre'],
            Notificaciones::cuando($reserva['fecha'], $reserva['hora_inicio']),
            $pagado > 0 ? '. Había pagado ' . pesos($pagado) . ': coordiná la devolución.' : ''
        ));

        $respuesta = ['reserva' => $this->publica($this->turnos->buscarReserva($id))];
        if ($pagado > 0) {
            $respuesta['aviso'] = 'Le avisamos al complejo para que te devuelva los ' . pesos($pagado) . ' que pagaste.';
        }
        responder(200, $respuesta);
    }

    /**
     * Los nombres de la vaquita: de 2 a 10, el primero es el del jugador. Los vacíos se completan.
     *
     * @return list<string>
     */
    private function nombresDeLaVaquita(mixed $partes): array
    {
        if (!is_array($partes) || !array_is_list($partes)
            || count($partes) < VaquitaParte::MINIMO_PARTES || count($partes) > VaquitaParte::MAXIMO_PARTES) {
            responder(400, ['error' => sprintf('La vaquita es de %d a %d personas', VaquitaParte::MINIMO_PARTES, VaquitaParte::MAXIMO_PARTES)]);
        }
        $nombres = [];
        foreach ($partes as $i => $parte) {
            $nombre = is_array($parte) ? trim(textoDe($parte, 'nombre')) : '';
            if (mb_strlen($nombre) > 40) {
                responder(400, ['error' => 'Cada nombre puede tener hasta 40 letras']);
            }
            if ($nombre === '') {
                $nombre = $i === 0 ? strtok($this->usuario()['nombre'], ' ') : 'Amigo ' . ($i + 1);
            }
            $nombres[] = $nombre;
        }
        return $nombres;
    }

    // La reserva como la ve el jugador
    private function publica(array $r): array
    {
        $inicio = strtotime("{$r['fecha']} {$r['hora_inicio']}");
        $fin = strtotime(AgendaService::rango($r['fecha'], $r['hora_inicio'], $r['hora_fin'])[1]);
        $total = round((float) $r['precio'] + (float) $r['extras'], 2);
        $pagado = round((float) $r['pagado'], 2);
        $senaPendiente = Turno::senaPendiente($r);
        // Mientras la seña está pendiente es solo una reserva provisoria: se puede soltar hasta que empiece
        $cancelableHasta = $senaPendiente ? $inicio : $inicio - (int) $r['cancelacion_horas'] * 3600;

        // Solo el link que paga lo que falta (o la seña pendiente). Uno que ya no corresponde
        // (por ejemplo, la seña se pagó en el complejo) no se ofrece
        $vigentes = [$total - $pagado, $senaPendiente ? (float) $r['sena'] - $pagado : -1];
        $partes = $this->vaquita->listarDelTurno((int) $r['id']);
        $deLaVaquita = array_map(fn (array $p) => (int) $p['link_id'], $partes);
        $link = null;
        foreach ($this->links->pendientesDelTurno((int) $r['id']) as $l) {
            $corresponde = !in_array((int) $l['id'], $deLaVaquita, true)
                && (abs((float) $l['monto'] - $vigentes[0]) < 0.01 || abs((float) $l['monto'] - $vigentes[1]) < 0.01);
            if ($corresponde && $l['vence_en'] > date('Y-m-d H:i:s') && $l['url'] !== '') {
                $link = $this->links->publico($l);
            }
        }

        return [
            'id' => (int) $r['id'],
            'fecha' => $r['fecha'],
            'horaInicio' => horaCorta($r['hora_inicio']),
            'horaFin' => horaCorta($r['hora_fin']),
            'duracionMin' => (int) (($fin - $inicio) / 60),
            'estado' => $r['estado'],
            'estadoPago' => $r['estado_pago'],
            'precio' => (float) $r['precio'],
            'total' => $total,
            'pagado' => $pagado,
            'saldo' => round(max($total - $pagado, 0), 2),
            'sena' => $r['sena'] !== null ? (float) $r['sena'] : null,
            'senaPendiente' => $senaPendiente,
            'senaVenceEn' => $senaPendiente ? substr($r['sena_vence_en'], 0, 16) : null,
            'terminada' => $fin <= time(),
            'puedeCancelar' => $r['estado'] === 'confirmado' && time() < $cancelableHasta,
            'cancelableHasta' => date('Y-m-d H:i', $cancelableHasta),
            'cancelacionHoras' => (int) $r['cancelacion_horas'],
            'linkPago' => $link,
            // Premio de fidelidad: lo que se descontó
            'descuento' => (float) $r['descuento'],
            'meFaltaUno' => $this->meFaltaUno((int) $r['id']),
            // La vaquita: lo que pone cada uno y si ya pagó
            'vaquita' => array_map([$this->vaquita, 'publico'], $partes),
            'vaquitaEnMarcha' => array_filter($partes, fn (array $p) => VaquitaParte::estado($p) === 'pendiente') !== [],
            'complejo' => [
                'id' => (int) $r['complejo_id'],
                'nombre' => $r['complejo_nombre'],
                'direccion' => $r['complejo_direccion'],
                'ciudad' => $r['complejo_ciudad'],
                'telefono' => $r['complejo_telefono'],
                'ubicacion' => Complejo::ubicacion($r, 'complejo_'),
            ],
            'cancha' => [
                'id' => (int) $r['cancha_id'],
                'nombre' => $r['cancha_nombre'],
                'deporte' => $r['cancha_deporte'],
                'techada' => (bool) $r['cancha_techada'],
            ],
        ];
    }

    // Si busca jugadores: cuántos, de qué nivel y quiénes se sumaron (con su celular, para coordinar)
    private function meFaltaUno(int $turnoId): ?array
    {
        $partidos = new PartidoAbierto($this->pdo);
        $partido = $partidos->buscarPorTurno($turnoId);
        if ($partido === null) {
            return null;
        }
        return [
            'buscan' => (int) $partido['faltan'],
            'nivel' => $partido['nivel'],
            'comentario' => $partido['comentario'],
            'cerrado' => (bool) $partido['cerrado'],
            'sumados' => array_map(
                fn (array $j) => ['nombre' => $j['nombre'], 'telefono' => $j['telefono']],
                $partidos->jugadores((int) $partido['id'])
            ),
        ];
    }

    /**
     * Link de Mercado Pago por la seña que falta o por todo el saldo. Si ya hay uno pendiente
     * por ese monto, se reusa. Con la seña pendiente, el link vence cuando vence la seña.
     */
    private function linkDePago(array $reserva, string $que): array
    {
        $id = (int) $reserva['id'];
        if ($reserva['estado'] !== 'confirmado') {
            throw new ErrorHttp(409, 'Esta reserva no está confirmada');
        }
        $fin = AgendaService::rango($reserva['fecha'], $reserva['hora_inicio'], $reserva['hora_fin'])[1];
        if ($fin <= date('Y-m-d H:i:s')) {
            throw new ErrorHttp(409, 'Esta reserva ya terminó: lo que falta se paga en el complejo');
        }
        $cuenta = (new CobroService($this->pdo))->cuenta($id);
        $monto = $que === 'sena' ? round((float) $reserva['sena'] - $cuenta['pagado'], 2) : $cuenta['saldo'];
        if ($monto <= 0) {
            throw new ErrorHttp(409, 'Esta reserva ya está pagada');
        }

        $pendientes = $this->links->pendientesDelTurno($id);
        foreach ($pendientes as $l) {
            if (abs((float) $l['monto'] - $monto) < 0.01 && $l['vence_en'] > date('Y-m-d H:i:s') && $l['url'] !== '') {
                return $this->links->publico($l);
            }
        }
        if (count($pendientes) >= 3) {
            throw new ErrorHttp(409, 'Esta reserva ya tiene varios links de pago sin usar. Probá de nuevo en un rato.');
        }

        $vence = Turno::senaPendiente($reserva)
            ? $reserva['sena_vence_en']
            : min(date('Y-m-d H:i:s', strtotime('+' . LinkPago::HORAS_VIGENCIA . ' hours')), $fin);
        $link = (new LinksDePago($this->pdo))->crear($reserva, $monto, $vence, new MercadoPago());
        return $this->links->publico($link);
    }

    // Una reserva del jugador logueado (404 si es de otro: no se dice que existe)
    private function reservaDelJugador(int $id): array
    {
        $this->soloJugador();
        $reserva = $this->turnos->buscarReserva($id);
        if ($reserva === null || (int) $reserva['jugador_id'] !== $this->usuarioActual()) {
            responder(404, ['error' => 'Esa reserva no existe']);
        }
        return $reserva;
    }

    private function complejoQueReserva(int $id): array
    {
        $complejo = $this->complejos->buscarPorId($id);
        if ($complejo === null || !$complejo['visible']) {
            responder(404, ['error' => 'Ese complejo no existe o ya no está en CanchasYa']);
        }
        return $complejo;
    }

    // Desde hoy hasta los días de anticipación que fija el complejo
    private function validarFecha(array $complejo, string $fecha): void
    {
        if ($fecha < hoy()) {
            responder(400, ['error' => 'Ese día ya pasó']);
        }
        $dias = (int) $complejo['reserva_dias'];
        if ($fecha > sumarDias(hoy(), $dias)) {
            responder(409, ['error' => sprintf('%s toma reservas hasta %s', $complejo['nombre'], $dias === 1 ? 'mañana' : "$dias días antes")]);
        }
    }

    // Lo que juega: de lo que dura el turno de la cancha a 4 horas, de a media hora
    private function duracion(array $datos, array $cancha): int
    {
        $minimo = (int) $cancha['duracion_min'];
        $duracion = $datos['duracionMin'] ?? $minimo;
        if (!is_int($duracion) || $duracion < $minimo || $duracion > self::DURACION_MAXIMA || $duracion % self::PASO_MINUTOS !== 0) {
            responder(400, ['error' => sprintf(
                'En esta cancha se juega de %s a %s, de a media hora',
                duracionVisible($minimo),
                duracionVisible(self::DURACION_MAXIMA)
            )]);
        }
        return $duracion;
    }

    /**
     * El celular del jugador: el de su cuenta o el que manda (y se guarda en su cuenta).
     * El complejo lo necesita para escribirle por la reserva.
     */
    private function telefonoDelJugador(array $datos): string
    {
        $usuarios = new Usuario($this->pdo);
        $nuevo = trim(textoDe($datos, 'telefono'));
        if ($nuevo !== '') {
            $telefono = normalizarTelefono($nuevo);
            if ($telefono === null) {
                responder(400, ['error' => 'El celular no es válido. Escribilo con el código de área (por ejemplo, 11 5555 1234).']);
            }
            $usuarios->guardarTelefono($this->usuarioActual(), $telefono);
            return $telefono;
        }
        $telefono = $usuarios->buscarPorId($this->usuarioActual())['telefono'] ?? null;
        if ($telefono === null || $telefono === '') {
            responder(400, [
                'error' => 'Para reservar necesitamos tu celular: el complejo te puede escribir por la reserva.',
                'codigo' => 'falta_telefono',
            ]);
        }
        return $telefono;
    }

    private function avisarAlComplejo(string $titulo, array $reserva, string $cuerpo): void
    {
        (new Notificaciones($this->pdo))->alComplejo(
            (int) $reserva['complejo_id'],
            $titulo,
            $cuerpo,
            ['turnoId' => (int) $reserva['id']]
        );
    }
}
