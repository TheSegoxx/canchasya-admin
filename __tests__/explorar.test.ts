import { textoDistancia } from '../src/api/explorar';

test('distancia en metros o kilómetros', () => {
  expect(textoDistancia(0.84)).toBe('a 840 m');
  expect(textoDistancia(3.4)).toBe('a 3,4 km');
  expect(textoDistancia(12)).toBe('a 12,0 km');
});
