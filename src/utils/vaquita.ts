import type { ParteVaquita, Reserva } from '../api/reservas';
import { DIAS, deISO, diaSemana } from './fechas';
import { formatearPesos } from './formato';

/**
 * La vaquita: lo que falta pagar dividido entre los amigos (las mismas cuentas que hace la API).
 */

export const MINIMO_PARTES = 2;
export const MAXIMO_PARTES = 10;

/**
 * Divide en pesos enteros. Lo que sobra (pesos y centavos) va a la primera parte, la del organizador.
 * Ej.: 81000 entre 7 = 11574 + 6 × 11571.
 */
export function dividirVaquita(saldo: number, partes: number): number[] {
  const centavos = Math.round(saldo * 100);
  const cadaUno = Math.floor(centavos / partes / 100) * 100;
  const primera = centavos - cadaUno * (partes - 1);
  return [primera / 100, ...Array(partes - 1).fill(cadaUno / 100)];
}

// Para empezar: 4 en pádel, 10 en fútbol 5
export const personasPorDeporte = (deporte: string) => (deporte === 'padel' ? 4 : 10);

// Cuánto se juntó y cuánto falta entre las partes vigentes
export function avance(partes: ParteVaquita[]): { juntado: number; total: number; pagaron: number } {
  const pagadas = partes.filter(p => p.estado === 'pagada');
  return {
    juntado: pagadas.reduce((suma, p) => suma + p.monto, 0),
    total: partes.reduce((suma, p) => suma + p.monto, 0),
    pagaron: pagadas.length,
  };
}

// "el domingo 18 a las 17:00"
function cuando(r: Reserva): string {
  return `el ${DIAS[diaSemana(r.fecha) - 1]} ${deISO(r.fecha).getDate()} a las ${r.horaInicio}`;
}

// El mensaje para un amigo, con su link
export function mensajeParte(r: Reserva, parte: ParteVaquita): string {
  return (
    `¡Hola ${parte.nombre}! Armé la vaquita para jugar ${cuando(r)} en ${r.complejo.nombre} (${r.cancha.nombre}). ` +
    `Te toca ${formatearPesos(parte.monto)}. Pagalo con Mercado Pago acá:\n${parte.url}`
  );
}

// Un solo mensaje para el grupo: cada uno busca su nombre y paga con su link
export function mensajeGrupo(r: Reserva, partes: ParteVaquita[]): string {
  const lineas = partes
    .filter(p => p.estado === 'pendiente' && p.url && !p.esOrganizador)
    .map(p => `• ${p.nombre}: ${formatearPesos(p.monto)} → ${p.url}`);
  return [
    `⚽ Vaquita para jugar ${cuando(r)} en ${r.complejo.nombre} (${r.cancha.nombre}).`,
    'Cada uno paga su parte con Mercado Pago en su link:',
    ...lineas,
  ].join('\n');
}
