import type { ParteVaquita, Reserva } from '../src/api/reservas';
import { avance, dividirVaquita, mensajeGrupo, mensajeParte, personasPorDeporte } from '../src/utils/vaquita';

const parte = (id: number, nombre: string, monto: number, estado: ParteVaquita['estado'], esOrganizador = false): ParteVaquita => ({
  id,
  nombre,
  monto,
  esOrganizador,
  estado,
  url: estado === 'pendiente' ? `https://mp.test/${id}` : null,
});

const reserva = {
  fecha: '2026-10-18',
  horaInicio: '17:00',
  complejo: { nombre: 'Complejo Demo' },
  cancha: { nombre: 'Fútbol 5' },
} as Reserva;

describe('dividir la vaquita', () => {
  test('en partes iguales cuando da justo', () => {
    expect(dividirVaquita(72000, 4)).toEqual([18000, 18000, 18000, 18000]);
  });

  test('lo que sobra lo pone el organizador (igual que la API)', () => {
    expect(dividirVaquita(81000, 7)).toEqual([11574, 11571, 11571, 11571, 11571, 11571, 11571]);
  });

  test('con centavos', () => {
    const montos = dividirVaquita(1000.5, 3);
    expect(montos).toEqual([334.5, 333, 333]);
    expect(montos.reduce((a, b) => a + b, 0)).toBeCloseTo(1000.5);
  });

  test('cuántos para empezar', () => {
    expect(personasPorDeporte('padel')).toBe(4);
    expect(personasPorDeporte('futbol5')).toBe(10);
  });
});

describe('avance y mensajes', () => {
  const partes = [
    parte(1, 'Sofía', 20250, 'pendiente', true),
    parte(2, 'Juan', 20250, 'pagada'),
    parte(3, 'Pedro', 20250, 'pendiente'),
    parte(4, 'Lucas', 20250, 'vencida'),
  ];

  test('cuánto juntaron', () => {
    expect(avance(partes)).toEqual({ juntado: 20250, total: 81000, pagaron: 1 });
  });

  test('mensaje para un amigo con su link', () => {
    expect(mensajeParte(reserva, partes[2])).toBe(
      '¡Hola Pedro! Armé la vaquita para jugar el domingo 18 a las 17:00 en Complejo Demo (Fútbol 5). ' +
        'Te toca $ 20.250. Pagalo con Mercado Pago acá:\nhttps://mp.test/3',
    );
  });

  test('mensaje al grupo: solo los que faltan (sin el organizador)', () => {
    const texto = mensajeGrupo(reserva, partes);
    expect(texto).toContain('• Pedro: $ 20.250 → https://mp.test/3');
    expect(texto).not.toContain('Juan');
    expect(texto).not.toContain('Sofía');
    expect(texto).not.toContain('Lucas');
  });
});
