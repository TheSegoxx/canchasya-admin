import type { Bloqueo, CanchaAgenda, Turno } from '../api/agenda';
import type { Ubicacion } from '../api/complejo';
import { linkMapa } from './acciones';
import { DIAS, diaEnPlural, diaSemana, fechaCorta } from './fechas';
import { formatearPesos } from './formato';
import { aHora, aMinutos, seSuperponen } from './horas';

/**
 * Reglas de la agenda que la app calcula sola (las mismas que controla la API).
 */

// Cada cuánto se puede empezar un turno
export const PASO_MINUTOS = 30;

export const turnoActivo = (t: Turno) => t.estado !== 'cancelado';

type Dia = {
  apertura: string;
  cierre: string;
  turnos: Turno[];
  bloqueos: Bloqueo[];
  // Si es hoy: no se ofrecen los horarios que ya terminaron
  minutosAhora?: number;
};

// Horarios de inicio libres de una cancha en un día (cada 30 minutos)
export function horariosLibres(cancha: CanchaAgenda, dia: Dia): string[] {
  const libres: string[] = [];
  const ultimoInicio = aMinutos(dia.cierre) - cancha.duracionMin;
  for (let m = aMinutos(dia.apertura); m <= ultimoInicio; m += PASO_MINUTOS) {
    const inicio = aHora(m);
    const fin = aHora(m + cancha.duracionMin);
    const yaTermino = dia.minutosAhora !== undefined && m + cancha.duracionMin <= dia.minutosAhora;
    const ocupado =
      dia.turnos.some(t => t.canchaId === cancha.id && turnoActivo(t) && seSuperponen(inicio, fin, t.horaInicio, t.horaFin)) ||
      dia.bloqueos.some(b => b.canchaId === cancha.id && seSuperponen(inicio, fin, b.horaDesde, b.horaHasta));
    if (!yaTermino && !ocupado) {
      libres.push(inicio);
    }
  }
  return libres;
}

type DatosMensaje = {
  nombreCliente: string;
  complejo: string;
  direccion?: string;
  ubicacion?: Ubicacion | null;
  cancha: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  precio: number;
  diaFijo?: number; // si es un turno fijo
};

// "sábado 18/10"
const diaYFecha = (d: DatosMensaje) => `${DIAS[diaSemana(d.fecha) - 1]} ${fechaCorta(d.fecha)}`;

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0];

export function mensajeConfirmacion(d: DatosMensaje): string {
  const lineas = [
    `¡Hola ${primerNombre(d.nombreCliente)}! Te confirmo tu turno en ${d.complejo}:`,
    `📅 ${diaYFecha(d)}, de ${d.horaInicio} a ${d.horaFin}`,
    `Cancha: ${d.cancha}`,
    `Precio: ${formatearPesos(d.precio)}`,
  ];
  if (d.direccion) {
    lineas.push(`📍 ${d.direccion}`);
  }
  if (d.ubicacion) {
    lineas.push(`Cómo llegar: ${linkMapa(d.ubicacion)}`);
  }
  if (d.diaFijo) {
    lineas.push(`Es tu turno fijo de todos los ${diaEnPlural(d.diaFijo)}.`);
  }
  lineas.push('¡Te esperamos!');
  return lineas.join('\n');
}

export function mensajeCancelacion(d: DatosMensaje): string {
  return (
    `Hola ${primerNombre(d.nombreCliente)}, te aviso que se canceló tu turno del ${diaYFecha(d)} ` +
    `a las ${d.horaInicio} en ${d.cancha} (${d.complejo}). Cualquier cosa escribime así lo reprogramamos.`
  );
}

// El mensaje que corresponde al estado del turno: confirmación o aviso de cancelación
export function mensajeDeTurno(
  turno: Turno,
  lugar: { complejo: string; direccion?: string; ubicacion?: Ubicacion | null; cancha: string },
): string {
  const datos: DatosMensaje = {
    nombreCliente: turno.cliente.nombre,
    complejo: lugar.complejo,
    direccion: lugar.direccion,
    ubicacion: lugar.ubicacion,
    cancha: lugar.cancha,
    fecha: turno.fecha,
    horaInicio: turno.horaInicio,
    horaFin: turno.horaFin,
    precio: turno.precio,
    diaFijo: turno.turnoFijoId !== null ? diaSemana(turno.fecha) : undefined,
  };
  return turno.estado === 'cancelado' ? mensajeCancelacion(datos) : mensajeConfirmacion(datos);
}
