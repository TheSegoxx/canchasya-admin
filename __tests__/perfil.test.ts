import { PERFIL_VACIO, perfilParaApi, validarPerfil } from '../src/components/DatosPersonales';

describe('datos personales', () => {
  const perfil = { ...PERFIL_VACIO, nombre: ' Juli Pérez ', telefono: '351 555-1234', ciudad: ' Córdoba ', deportes: ['padel' as const] };

  test('pide nombre y celular con código de área', () => {
    expect(validarPerfil(perfil)).toBe('');
    expect(validarPerfil({ ...perfil, nombre: '  ' })).toBe('Ingresá tu nombre y apellido.');
    expect(validarPerfil({ ...perfil, telefono: '1234' })).toContain('celular');
  });

  test('los deportes solo van para el jugador', () => {
    expect(perfilParaApi(perfil, 'jugador')).toEqual({
      nombre: 'Juli Pérez',
      telefono: '351 555-1234',
      ciudad: 'Córdoba',
      deportes: ['padel'],
    });
    expect(perfilParaApi(perfil, 'dueno')).not.toHaveProperty('deportes');
  });
});
