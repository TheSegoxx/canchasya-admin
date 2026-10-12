import { aISO, deISO, DIAS_CORTOS, diaSemana, fechaCorta, inicioDeSemana, MESES, MESES_CORTOS, sumarDias } from './fechas';

/**
 * Períodos del dashboard: una semana (lunes a domingo), un mes o un año,
 * a partir de una fecha de referencia "AAAA-MM-DD".
 */

export type Periodo = 'semana' | 'mes' | 'anio';

export const NOMBRE_PERIODO: Record<Periodo, string> = { semana: 'Semana', mes: 'Mes', anio: 'Año' };

export function rangoDe(periodo: Periodo, referencia: string): { desde: string; hasta: string } {
  if (periodo === 'semana') {
    const lunes = inicioDeSemana(referencia);
    return { desde: lunes, hasta: sumarDias(lunes, 6) };
  }
  const fecha = deISO(referencia);
  if (periodo === 'mes') {
    return {
      desde: aISO(new Date(fecha.getFullYear(), fecha.getMonth(), 1)),
      hasta: aISO(new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)),
    };
  }
  return { desde: `${fecha.getFullYear()}-01-01`, hasta: `${fecha.getFullYear()}-12-31` };
}

// Corre la referencia un período para atrás (-1) o para adelante (+1)
export function moverPeriodo(periodo: Periodo, referencia: string, delta: number): string {
  if (periodo === 'semana') {
    return sumarDias(referencia, 7 * delta);
  }
  const fecha = deISO(referencia);
  // Día 1 para que, por ejemplo, del 31/01 no se salte febrero
  return periodo === 'mes'
    ? aISO(new Date(fecha.getFullYear(), fecha.getMonth() + delta, 1))
    : aISO(new Date(fecha.getFullYear() + delta, 0, 1));
}

// "Semana del 6/10 al 12/10", "Octubre 2026", "2026"
export function tituloPeriodo(periodo: Periodo, referencia: string): string {
  const { desde, hasta } = rangoDe(periodo, referencia);
  const fecha = deISO(referencia);
  if (periodo === 'semana') {
    return `Semana del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
  }
  if (periodo === 'mes') {
    const mes = MESES[fecha.getMonth()];
    return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${fecha.getFullYear()}`;
  }
  return String(fecha.getFullYear());
}

// Etiqueta corta de cada barra: "lun" (semana), "12" (mes) o "oct" (año, clave "2026-10")
export function etiquetaDeClave(clave: string, periodo: Periodo): string {
  if (clave.length === 7) {
    return MESES_CORTOS[Number(clave.slice(5)) - 1];
  }
  return periodo === 'semana' ? DIAS_CORTOS[diaSemana(clave) - 1] : String(Number(clave.slice(8)));
}

// Etiqueta larga para el detalle de una barra: "lun 12/10" u "octubre 2026"
export function etiquetaLarga(clave: string): string {
  if (clave.length === 7) {
    return `${MESES[Number(clave.slice(5)) - 1]} ${clave.slice(0, 4)}`;
  }
  return `${DIAS_CORTOS[diaSemana(clave) - 1]} ${fechaCorta(clave)}`;
}

// Montos cortos para el eje: 950 -> "950", 24000 -> "24K", 1500000 -> "1,5M"
export function montoCompacto(monto: number): string {
  const absoluto = Math.abs(monto);
  const signo = monto < 0 ? '-' : '';
  if (absoluto >= 1_000_000) {
    return `${signo}${String(Math.round(absoluto / 100_000) / 10).replace('.', ',')}M`;
  }
  if (absoluto >= 1_000) {
    return `${signo}${Math.round(absoluto / 1_000)}K`;
  }
  return `${signo}${Math.round(absoluto)}`;
}

// Tope del eje para que las marcas caigan en números redondos (secciones de 1, 2, 2,5 o 5 × 10ⁿ)
export function topeRedondo(maximo: number, secciones: number): number {
  if (maximo <= 0) {
    return secciones;
  }
  const crudo = maximo / secciones;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map(f => f * potencia).find(p => p >= crudo) ?? 10 * potencia;
  return paso * secciones;
}
