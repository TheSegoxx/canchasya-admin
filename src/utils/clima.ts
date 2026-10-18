import type { HoraClima } from '../api/jugador';
import { aMinutos } from './horas';

/**
 * El pronóstico del turno en pocas palabras (códigos de la Organización Meteorológica Mundial).
 */

export function describirClima(codigo: number): { texto: string; emoji: string } {
  if (codigo === 0) {
    return { texto: 'Despejado', emoji: '☀️' };
  }
  if (codigo <= 2) {
    return { texto: 'Algo nublado', emoji: '⛅' };
  }
  if (codigo === 3) {
    return { texto: 'Nublado', emoji: '☁️' };
  }
  if (codigo === 45 || codigo === 48) {
    return { texto: 'Niebla', emoji: '🌫️' };
  }
  if (codigo >= 51 && codigo <= 57) {
    return { texto: 'Llovizna', emoji: '🌦️' };
  }
  if ((codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) {
    return { texto: 'Lluvia', emoji: '🌧️' };
  }
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) {
    return { texto: 'Nieve', emoji: '❄️' };
  }
  if (codigo >= 95) {
    return { texto: 'Tormenta', emoji: '⛈️' };
  }
  return { texto: 'Variable', emoji: '🌤️' };
}

// A partir de qué probabilidad de lluvia se avisa (si la cancha es al aire libre)
export const LLUVIA_PARA_AVISAR = 50;

export type ClimaDelTurno = {
  temperatura: number; // al empezar
  lluvia: number; // la probabilidad más alta mientras se juega
  texto: string;
  emoji: string;
};

// El clima mientras se juega (de la hora en que empieza a la última hora que se juega)
export function climaDelTurno(horas: HoraClima[], inicio: string, fin: string): ClimaDelTurno | null {
  const desde = Math.floor(aMinutos(inicio) / 60) * 60;
  const hasta = aMinutos(fin);
  const delTurno = horas.filter(h => aMinutos(h.hora) >= desde && aMinutos(h.hora) < hasta);
  if (delTurno.length === 0) {
    return null;
  }
  // El peor código del rato (los de lluvia y tormenta son los más altos)
  const peor = delTurno.reduce((a, b) => (b.codigo > a.codigo ? b : a));
  return {
    temperatura: Math.round(delTurno[0].temperatura),
    lluvia: Math.max(...delTurno.map(h => h.lluvia)),
    ...describirClima(peor.codigo),
  };
}
