/**
 * Fechas como texto "AAAA-MM-DD" (igual que la API), siempre en la hora local
 * del celular. Se arman a mano para no depender de Intl en Android.
 */

export const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const dosCifras = (n: number) => String(n).padStart(2, '0');

export function aISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${dosCifras(fecha.getMonth() + 1)}-${dosCifras(fecha.getDate())}`;
}

// new Date("2026-10-18") la tomaría en UTC (el día anterior en Argentina): se arma local
export function deISO(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function hoyISO(): string {
  return aISO(new Date());
}

export function sumarDias(iso: string, dias: number): string {
  const fecha = deISO(iso);
  fecha.setDate(fecha.getDate() + dias);
  return aISO(fecha);
}

// 1 = lunes ... 7 = domingo (como la API)
export function diaSemana(iso: string): number {
  return ((deISO(iso).getDay() + 6) % 7) + 1;
}

// Lunes de la semana de esa fecha
export function inicioDeSemana(iso: string): string {
  return sumarDias(iso, 1 - diaSemana(iso));
}

// Para "todos los sábados": lunes a viernes no cambian en plural
export function diaEnPlural(diaSemanaNumero: number): string {
  const dia = DIAS[diaSemanaNumero - 1];
  return dia.endsWith('s') ? dia : `${dia}s`;
}

// "18/10"
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// "sábado 18 de octubre"
export function fechaLarga(iso: string): string {
  const fecha = deISO(iso);
  return `${DIAS[diaSemana(iso) - 1]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

// "Hoy", "Mañana" o "sábado 18 de octubre"
export function fechaRelativa(iso: string, hoy = hoyISO()): string {
  if (iso === hoy) {
    return 'Hoy';
  }
  if (iso === sumarDias(hoy, 1)) {
    return 'Mañana';
  }
  if (iso === sumarDias(hoy, -1)) {
    return 'Ayer';
  }
  const larga = fechaLarga(iso);
  return larga.charAt(0).toUpperCase() + larga.slice(1);
}
