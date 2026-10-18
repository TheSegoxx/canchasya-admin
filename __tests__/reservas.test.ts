import type { CanchaFicha } from '../src/api/explorar';
import type { Reserva } from '../src/api/reservas';
import {
  duracionesPosibles,
  estadoReserva,
  horariosParaReservar,
  montoSena,
  precioReserva,
  textoDuracion,
  textoPlazoCancelacion,
} from '../src/utils/reservas';

const futbol: CanchaFicha = {
  id: 1,
  nombre: 'Fútbol 5',
  deporte: 'futbol5',
  superficie: null,
  techada: false,
  duracionMin: 60,
  precioBase: 36000,
  franjas: [{ id: 1, horaDesde: '18:00', horaHasta: '24:00', precio: 45000 }],
  fotos: [],
};

const padel: CanchaFicha = { ...futbol, id: 2, deporte: 'padel', duracionMin: 90, precioBase: 24000, franjas: [] };

describe('duración', () => {
  test('de lo que dura el turno a 4 horas, de a media hora', () => {
    expect(duracionesPosibles(60)).toEqual([60, 90, 120, 150, 180, 210, 240]);
    expect(duracionesPosibles(90)).toEqual([90, 120, 150, 180, 210, 240]);
  });

  test('texto', () => {
    expect(textoDuracion(60)).toBe('1 hora');
    expect(textoDuracion(90)).toBe('1 h 30 min');
    expect(textoDuracion(120)).toBe('2 horas');
    expect(textoDuracion(30)).toBe('30 min');
  });
});

describe('precio por tramos', () => {
  test('un turno entero de día o de noche', () => {
    expect(precioReserva(futbol, '10:00', '11:00')).toBe(36000);
    expect(precioReserva(futbol, '20:00', '21:00')).toBe(45000);
  });

  test('dos horas que cruzan la franja: una de día y una de noche', () => {
    expect(precioReserva(futbol, '17:00', '19:00')).toBe(81000);
  });

  test('una hora y media: proporcional al turno de 60 minutos', () => {
    expect(precioReserva(futbol, '10:00', '11:30')).toBe(54000);
    expect(precioReserva(futbol, '23:00', '24:00')).toBe(45000);
  });

  test('pádel de 90 minutos jugando 2 horas', () => {
    expect(precioReserva(padel, '10:00', '12:00')).toBe(32000);
  });
});

describe('seña', () => {
  test('porcentaje redondeado al peso', () => {
    expect(montoSena(81000, 30)).toBe(24300);
    expect(montoSena(32333, 10)).toBe(3233);
    expect(montoSena(36000, 100)).toBe(36000);
  });

  test('sin seña', () => {
    expect(montoSena(36000, 0)).toBeNull();
    expect(montoSena(0, 30)).toBeNull();
  });

  test('plazo para cancelar', () => {
    expect(textoPlazoCancelacion(24)).toBe('hasta 24 horas antes');
    expect(textoPlazoCancelacion(1)).toBe('hasta 1 hora antes');
    expect(textoPlazoCancelacion(0)).toBe('hasta que empiece');
  });
});

describe('horarios para reservar', () => {
  const dia = {
    horaApertura: '08:00',
    horaCierre: '12:00',
    ahora: null,
    ocupados: [
      { canchaId: 1, horaDesde: '09:00', horaHasta: '10:00' },
      { canchaId: 2, horaDesde: '08:00', horaHasta: '12:00' },
    ],
  };

  test('cada media hora, sin pisar lo ocupado de esa cancha', () => {
    expect(horariosParaReservar(1, 60, dia)).toEqual(['08:00', '10:00', '10:30', '11:00']);
  });

  test('más tiempo deja menos horarios', () => {
    expect(horariosParaReservar(1, 120, dia)).toEqual(['10:00']);
    expect(horariosParaReservar(1, 180, dia)).toEqual([]);
  });

  test('hoy no se ofrece lo que ya empezó', () => {
    expect(horariosParaReservar(1, 60, { ...dia, ahora: '10:00' })).toEqual(['10:30', '11:00']);
  });

  test('otra cancha toda ocupada', () => {
    expect(horariosParaReservar(2, 60, dia)).toEqual([]);
  });

  test('hasta el cierre a medianoche', () => {
    const noche = { horaApertura: '22:00', horaCierre: '24:00', ahora: null, ocupados: [] };
    expect(horariosParaReservar(1, 60, noche)).toEqual(['22:00', '22:30', '23:00']);
  });
});

describe('estado de la reserva', () => {
  const base: Reserva = {
    id: 1,
    fecha: '2026-10-20',
    horaInicio: '17:00',
    horaFin: '19:00',
    duracionMin: 120,
    estado: 'confirmado',
    estadoPago: 'pendiente',
    precio: 81000,
    total: 81000,
    pagado: 0,
    saldo: 81000,
    sena: 24300,
    senaPendiente: true,
    senaVenceEn: '2026-10-17 21:46',
    terminada: false,
    puedeCancelar: true,
    cancelableHasta: '2026-10-20 17:00',
    cancelacionHoras: 24,
    linkPago: null,
    vaquita: [],
    vaquitaEnMarcha: false,
    descuento: 0,
    meFaltaUno: null,
    complejo: { id: 1, nombre: 'Complejo', direccion: 'Calle 1', ciudad: null, telefono: null, ubicacion: null },
    cancha: { id: 1, nombre: 'Fútbol 5', deporte: 'futbol5', techada: false },
  };

  test('seña pendiente', () => {
    expect(estadoReserva(base)).toEqual({ texto: 'Pagá la seña antes de las 21:46', tono: 'aviso' });
  });

  test('con la seña pagada', () => {
    const r = { ...base, senaPendiente: false, senaVenceEn: null, pagado: 24300, saldo: 56700 };
    expect(estadoReserva(r)).toEqual({ texto: 'Confirmada · Seña pagada', tono: 'bien' });
  });

  test('pagada, cancelada y jugada', () => {
    expect(estadoReserva({ ...base, senaPendiente: false, pagado: 81000, saldo: 0 }).texto).toBe('Confirmada · Pagada');
    expect(estadoReserva({ ...base, estado: 'cancelado' }).tono).toBe('mal');
    expect(estadoReserva({ ...base, terminada: true }).texto).toBe('Jugada');
  });
});
