import { formatearPesos, leerPesos, pesosParaEditar } from '../src/utils/formato';

describe('formatearPesos', () => {
  test('usa punto de miles y omite ",00"', () => {
    expect(formatearPesos(24000)).toBe('$ 24.000');
    expect(formatearPesos(1234567)).toBe('$ 1.234.567');
    expect(formatearPesos(0)).toBe('$ 0');
  });

  test('muestra los centavos con coma', () => {
    expect(formatearPesos(45000.5)).toBe('$ 45.000,50');
  });

  test('montos negativos', () => {
    expect(formatearPesos(-1500)).toBe('-$ 1.500');
  });
});

describe('leerPesos', () => {
  test('acepta las formas habituales de escribir un precio', () => {
    expect(leerPesos('24000')).toBe(24000);
    expect(leerPesos('24.000')).toBe(24000);
    expect(leerPesos('$ 24.000,50')).toBe(24000.5);
    expect(leerPesos('1.234.567')).toBe(1234567);
  });

  test('el punto seguido de 1 o 2 cifras es decimal, no de miles', () => {
    expect(leerPesos('24000.50')).toBe(24000.5);
    expect(leerPesos('1500.5')).toBe(1500.5);
    expect(leerPesos('24000,5')).toBe(24000.5);
  });

  test('rechaza lo que no es un importe', () => {
    expect(leerPesos('')).toBeNull();
    expect(leerPesos('abc')).toBeNull();
    expect(leerPesos('-100')).toBeNull();
    expect(leerPesos('10,999')).toBeNull();
    expect(leerPesos('24.0000')).toBeNull();
    expect(leerPesos('1.234,567')).toBeNull();
  });
});

test('pesosParaEditar vuelve a un texto que leerPesos entiende', () => {
  for (const monto of [24000, 45000.5, 0]) {
    expect(leerPesos(pesosParaEditar(monto))).toBe(monto);
  }
});
