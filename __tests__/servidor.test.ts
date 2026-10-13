import { normalizarServidor } from '../src/servidor';

describe('normalizarServidor', () => {
  test('solo la IP: agrega http y la carpeta de la API', () => {
    expect(normalizarServidor('192.168.1.7')).toBe('http://192.168.1.7/canchasya');
    expect(normalizarServidor(' 192.168.0.20 ')).toBe('http://192.168.0.20/canchasya');
  });

  test('con puerto', () => {
    expect(normalizarServidor('192.168.1.7:8080')).toBe('http://192.168.1.7:8080/canchasya');
  });

  test('dirección completa: se respeta (sin la barra final)', () => {
    expect(normalizarServidor('http://192.168.1.7/canchasya/')).toBe('http://192.168.1.7/canchasya');
    expect(normalizarServidor('https://api.canchasya.com/canchasya')).toBe('https://api.canchasya.com/canchasya');
  });

  test('inválidas', () => {
    expect(normalizarServidor('')).toBeNull();
    expect(normalizarServidor('192.168.1.7 abc')).toBeNull();
    expect(normalizarServidor('http://')).toBeNull();
  });
});
