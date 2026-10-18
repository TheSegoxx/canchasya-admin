import type { CanchaFicha } from '../api/explorar';
import type { Ocupado, Reserva } from '../api/reservas';
import { aHora, aMinutos } from './horas';

/**
 * Reglas de la reserva del jugador que la app calcula para mostrar (las mismas que controla la API).
 */

// Los turnos empiezan en punto o y media; se juega de lo que dura el turno de la cancha a 4 horas
export const PASO_MINUTOS = 30;
export const DURACION_MAXIMA = 240;

// Cuánto se puede jugar en esa cancha: 60 -> [60, 90, 120, ... 240]
export function duracionesPosibles(duracionCancha: number): number[] {
  const duraciones: number[] = [];
  for (let m = duracionCancha; m <= DURACION_MAXIMA; m += PASO_MINUTOS) {
    duraciones.push(m);
  }
  return duraciones;
}

// 60 -> "1 hora", 90 -> "1 h 30 min", 120 -> "2 horas"
export function textoDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (resto === 0) {
    return horas === 1 ? '1 hora' : `${horas} horas`;
  }
  return horas === 0 ? `${resto} min` : `${horas} h ${resto} min`;
}

type Dia = { horaApertura: string; horaCierre: string; ahora: string | null; ocupados: Ocupado[] };

// Las horas en que puede empezar a jugar $duracion minutos en esa cancha sin pisar a nadie
export function horariosParaReservar(canchaId: number, duracion: number, dia: Dia): string[] {
  const ocupados = dia.ocupados.filter(o => o.canchaId === canchaId);
  const ahora = dia.ahora !== null ? aMinutos(dia.ahora) : -1;
  const libres: string[] = [];
  for (let m = aMinutos(dia.horaApertura); m + duracion <= aMinutos(dia.horaCierre); m += PASO_MINUTOS) {
    const libre = ocupados.every(o => !(m < aMinutos(o.horaHasta) && m + duracion > aMinutos(o.horaDesde)));
    if (libre && m > ahora) {
      libres.push(aHora(m));
    }
  }
  return libres;
}

// Las horas que están ocupadas (para anotarse en la lista de espera): las que no están libres y no empezaron
export function horariosOcupados(canchaId: number, duracion: number, dia: Dia): string[] {
  const libres = new Set(horariosParaReservar(canchaId, duracion, dia));
  const ahora = dia.ahora !== null ? aMinutos(dia.ahora) : -1;
  const ocupados: string[] = [];
  for (let m = aMinutos(dia.horaApertura); m + duracion <= aMinutos(dia.horaCierre); m += PASO_MINUTOS) {
    if (m > ahora && !libres.has(aHora(m))) {
      ocupados.push(aHora(m));
    }
  }
  return ocupados;
}

/**
 * Precio de jugar de $inicio a $fin. Los precios de la cancha y de sus franjas son por turno
 * (lo que dura la cancha): cada tramo se cobra en proporción a los minutos que ocupa, redondeado al peso.
 */
export function precioReserva(cancha: CanchaFicha, inicio: string, fin: string): number {
  const desde = aMinutos(inicio);
  const hasta = aMinutos(fin);
  let total = 0;
  let conFranja = 0;
  for (const f of cancha.franjas) {
    const minutos = Math.min(hasta, aMinutos(f.horaHasta)) - Math.max(desde, aMinutos(f.horaDesde));
    if (minutos > 0) {
      total += minutos * f.precio;
      conFranja += minutos;
    }
  }
  total += (hasta - desde - conFranja) * cancha.precioBase;
  return Math.round(total / cancha.duracionMin);
}

// La seña es un porcentaje del precio, redondeado al peso (null si el complejo no pide seña)
export function montoSena(precio: number, porcentaje: number): number | null {
  const sena = Math.round((precio * porcentaje) / 100);
  return porcentaje > 0 && sena > 0 ? sena : null;
}

// "hasta 24 horas antes", "hasta 1 hora antes" o "hasta que empiece"
export function textoPlazoCancelacion(horas: number): string {
  if (horas === 0) {
    return 'hasta que empiece';
  }
  return `hasta ${horas === 1 ? '1 hora' : `${horas} horas`} antes`;
}

export type Tono = 'aviso' | 'bien' | 'neutro' | 'mal';

// Cómo está la reserva, en pocas palabras, y de qué color mostrarla
export function estadoReserva(r: Reserva): { texto: string; tono: Tono } {
  if (r.estado === 'cancelado') {
    return { texto: 'Cancelada', tono: 'mal' };
  }
  if (r.estado === 'jugado' || r.terminada) {
    return { texto: 'Jugada', tono: 'neutro' };
  }
  if (r.senaPendiente && r.senaVenceEn) {
    return { texto: `Pagá la seña antes de las ${r.senaVenceEn.slice(11)}`, tono: 'aviso' };
  }
  if (r.saldo <= 0) {
    return { texto: 'Confirmada · Pagada', tono: 'bien' };
  }
  return { texto: r.pagado > 0 ? 'Confirmada · Seña pagada' : 'Confirmada', tono: 'bien' };
}
