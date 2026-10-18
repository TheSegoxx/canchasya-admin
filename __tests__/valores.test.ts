import type { HoraClima } from '../src/api/jugador';
import { climaDelTurno, describirClima } from '../src/utils/clima';
import { horariosOcupados } from '../src/utils/reservas';

const hora = (h: number, lluvia: number, codigo: number, temperatura = 20): HoraClima => ({
  hora: `${String(h).padStart(2, '0')}:00`,
  temperatura,
  lluvia,
  codigo,
});

describe('clima', () => {
  test('descripción por código', () => {
    expect(describirClima(0)).toEqual({ texto: 'Despejado', emoji: '☀️' });
    expect(describirClima(2).texto).toBe('Algo nublado');
    expect(describirClima(63).texto).toBe('Lluvia');
    expect(describirClima(81).texto).toBe('Lluvia');
    expect(describirClima(95).texto).toBe('Tormenta');
  });

  const horas = [hora(16, 10, 1, 22.4), hora(17, 20, 2, 21.6), hora(18, 70, 61, 19), hora(19, 40, 3, 18)];

  test('el clima mientras se juega: la peor lluvia y la temperatura al empezar', () => {
    expect(climaDelTurno(horas, '17:00', '19:00')).toEqual({ temperatura: 22, lluvia: 70, texto: 'Lluvia', emoji: '🌧️' });
  });

  test('empezando y media se toma la hora en que empieza', () => {
    expect(climaDelTurno(horas, '16:30', '17:30')?.lluvia).toBe(20);
  });

  test('sin pronóstico para esas horas', () => {
    expect(climaDelTurno(horas, '21:00', '22:00')).toBeNull();
    expect(climaDelTurno([], '17:00', '18:00')).toBeNull();
  });
});

describe('lista de espera', () => {
  const dia = {
    horaApertura: '08:00',
    horaCierre: '12:00',
    ahora: null,
    ocupados: [{ canchaId: 1, horaDesde: '09:00', horaHasta: '10:00' }],
  };

  test('los horarios ocupados para anotarse', () => {
    expect(horariosOcupados(1, 60, dia)).toEqual(['08:30', '09:00', '09:30']);
  });

  test('hoy no se ofrece lo que ya empezó', () => {
    expect(horariosOcupados(1, 60, { ...dia, ahora: '09:00' })).toEqual(['09:30']);
  });

  test('otra cancha sin nada ocupado', () => {
    expect(horariosOcupados(2, 60, dia)).toEqual([]);
  });
});
