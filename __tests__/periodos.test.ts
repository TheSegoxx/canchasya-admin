import { etiquetaDeClave, etiquetaLarga, montoCompacto, moverPeriodo, rangoDe, tituloPeriodo, topeRedondo } from '../src/utils/periodos';

describe('períodos del dashboard', () => {
  test('semana de lunes a domingo', () => {
    expect(rangoDe('semana', '2026-10-11')).toEqual({ desde: '2026-10-05', hasta: '2026-10-11' });
    expect(tituloPeriodo('semana', '2026-10-11')).toBe('Semana del 05/10 al 11/10');
  });

  test('mes completo, también febrero', () => {
    expect(rangoDe('mes', '2026-10-11')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(rangoDe('mes', '2028-02-10')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
    expect(tituloPeriodo('mes', '2026-10-11')).toBe('Octubre 2026');
  });

  test('año', () => {
    expect(rangoDe('anio', '2026-10-11')).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' });
  });

  test('moverse entre períodos', () => {
    expect(moverPeriodo('mes', '2026-01-31', 1)).toBe('2026-02-01');
    expect(moverPeriodo('mes', '2026-01-15', -1)).toBe('2025-12-01');
    expect(moverPeriodo('semana', '2026-10-11', 1)).toBe('2026-10-18');
    expect(moverPeriodo('anio', '2026-10-11', -1)).toBe('2025-01-01');
  });

  test('etiquetas', () => {
    expect(etiquetaDeClave('2026-10-12', 'semana')).toBe('lun');
    expect(etiquetaDeClave('2026-10-05', 'mes')).toBe('5');
    expect(etiquetaDeClave('2026-10', 'anio')).toBe('oct');
    expect(etiquetaLarga('2026-10-12')).toBe('lun 12/10');
    expect(etiquetaLarga('2026-10')).toBe('octubre 2026');
  });

  test('montos compactos para el eje', () => {
    expect(montoCompacto(950)).toBe('950');
    expect(montoCompacto(24000)).toBe('24K');
    expect(montoCompacto(1500000)).toBe('1,5M');
    expect(montoCompacto(-18000)).toBe('-18K');
  });
});

test('tope redondo del eje', () => {
  expect(topeRedondo(150000, 4)).toBe(200000); // 50K por sección
  expect(topeRedondo(80000, 4)).toBe(80000); // 20K por sección
  expect(topeRedondo(90000, 4)).toBe(100000); // 25K
  expect(topeRedondo(9000, 4)).toBe(10000); // 2,5K
  expect(topeRedondo(0, 4)).toBe(4);
});
