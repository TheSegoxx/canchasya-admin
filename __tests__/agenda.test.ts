import type { Bloqueo, CanchaAgenda, Turno } from '../src/api/agenda';
import { horariosLibres, mensajeCancelacion, mensajeConfirmacion } from '../src/utils/agenda';
import { diaEnPlural, diaSemana, fechaLarga, fechaRelativa, inicioDeSemana, sumarDias } from '../src/utils/fechas';
import { formatearTelefono, linkWhatsApp } from '../src/utils/telefono';

const cancha: CanchaAgenda = {
  id: 1,
  nombre: 'Pádel 1',
  deporte: 'padel',
  superficie: null,
  techada: false,
  duracionMin: 90,
  precioBase: 20000,
  estado: 'libre',
  habilitada: true,
  franjas: [{ id: 1, horaDesde: '18:00', horaHasta: '24:00', precio: 28000 }],
};

const turno = (horaInicio: string, horaFin: string, estado: Turno['estado'] = 'confirmado'): Turno => ({
  id: 1,
  canchaId: 1,
  fecha: '2026-10-17',
  horaInicio,
  horaFin,
  precio: 20000,
  estado,
  estadoPago: 'pendiente',
  total: 20000,
  pagado: 0,
  turnoFijoId: null,
  cliente: { id: 1, nombre: 'Juan Pérez', telefono: '1155551234' },
});

describe('fechas', () => {
  test('suma días cruzando meses y años', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('día de la semana con lunes = 1', () => {
    expect(diaSemana('2026-10-12')).toBe(1); // lunes
    expect(diaSemana('2026-10-17')).toBe(6); // sábado
    expect(diaSemana('2026-10-18')).toBe(7); // domingo
    expect(inicioDeSemana('2026-10-18')).toBe('2026-10-12');
  });

  test('textos', () => {
    expect(fechaLarga('2026-10-17')).toBe('sábado 17 de octubre');
    expect(fechaRelativa('2026-10-12', '2026-10-11')).toBe('Mañana');
    expect(fechaRelativa('2026-10-17', '2026-10-11')).toBe('Sábado 17 de octubre');
    expect(diaEnPlural(6)).toBe('sábados');
    expect(diaEnPlural(2)).toBe('martes');
  });
});

describe('horariosLibres', () => {
  const dia = { apertura: '08:00', cierre: '12:00', turnos: [] as Turno[], bloqueos: [] as Bloqueo[] };

  test('cada 30 minutos, sin pasarse del cierre', () => {
    expect(horariosLibres(cancha, dia)).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30']);
  });

  test('saca los que se pisan con turnos activos y bloqueos', () => {
    const libres = horariosLibres(cancha, {
      ...dia,
      turnos: [turno('08:00', '09:30'), turno('10:30', '12:00', 'cancelado')],
      bloqueos: [{ id: 1, canchaId: 1, horaDesde: '11:30', horaHasta: '12:00', motivo: 'Lluvia' }],
    });
    expect(libres).toEqual(['09:30', '10:00']);
  });

  test('ignora los turnos de otras canchas', () => {
    expect(horariosLibres(cancha, { ...dia, turnos: [{ ...turno('08:00', '12:00'), canchaId: 2 }] })).toHaveLength(6);
  });

  test('hoy no ofrece los horarios que ya terminaron', () => {
    // 10:00: el de 08:30 (termina 10:00) ya pasó; el de 09:00 está en juego y se puede cargar
    expect(horariosLibres(cancha, { ...dia, minutosAhora: 600 })[0]).toBe('09:00');
  });
});

describe('WhatsApp', () => {
  test('formato del teléfono', () => {
    expect(formatearTelefono('1155551234')).toBe('11 5555-1234');
    expect(formatearTelefono('3515123456')).toBe('351 512-3456');
    expect(formatearTelefono('45551234')).toBe('45551234');
  });

  test('link con el número internacional y el texto codificado', () => {
    expect(linkWhatsApp('1155551234', 'Hola Juan')).toBe('https://wa.me/5491155551234?text=Hola%20Juan');
  });

  test('mensajes', () => {
    const datos = {
      nombreCliente: 'Juan Pérez',
      complejo: 'El Complejo',
      cancha: 'Pádel 1',
      fecha: '2026-10-17',
      horaInicio: '19:00',
      horaFin: '20:30',
      precio: 28000,
      diaFijo: 6,
    };
    const confirmacion = mensajeConfirmacion(datos);
    expect(confirmacion).toContain('¡Hola Juan!');
    expect(confirmacion).toContain('sábado 17/10, de 19:00 a 20:30');
    expect(confirmacion).toContain('$ 28.000');
    expect(confirmacion).toContain('todos los sábados');
    expect(mensajeCancelacion(datos)).toContain('se canceló tu turno del sábado 17/10 a las 19:00');
  });

  test('con la ubicación del complejo lleva el link "Cómo llegar"', () => {
    const confirmacion = mensajeConfirmacion({
      nombreCliente: 'Ana',
      complejo: 'El Complejo',
      cancha: 'Pádel 1',
      fecha: '2026-10-17',
      horaInicio: '19:00',
      horaFin: '20:30',
      precio: 28000,
      ubicacion: { latitud: -31.4201, longitud: -64.1888 },
    });
    expect(confirmacion).toContain('Cómo llegar: https://www.google.com/maps/search/?api=1&query=-31.4201,-64.1888');
  });
});
