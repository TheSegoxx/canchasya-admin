import type { DetalleTorneo, Formato, Partido } from '../api/torneos';
import { DIAS_CORTOS, diaSemana, fechaCorta } from './fechas';

// "Fecha 3" en una liga; "Semifinal", "Final"... en eliminación
export function nombreRonda(formato: Formato, ronda: number, totalRondas: number): string {
  if (formato === 'liga') {
    return `Fecha ${ronda}`;
  }
  const desdeElFinal = totalRondas - ronda;
  return ['Final', 'Semifinal', 'Cuartos de final', 'Octavos de final'][desdeElFinal] ?? `Ronda ${ronda}`;
}

export const totalRondas = (partidos: Partido[]) => Math.max(0, ...partidos.map(p => p.ronda));

// En eliminación, un partido de primera ronda con un solo equipo: ese equipo pasa directo
export const esLibre = (p: Partido) => p.ronda === 1 && (p.localId === null) !== (p.visitanteId === null);

// "sáb 18/10 20:00 · Cancha 1"
export function textoProgramacion(p: Partido): string | null {
  if (!p.fecha || !p.hora) {
    return null;
  }
  return `${DIAS_CORTOS[diaSemana(p.fecha) - 1]} ${fechaCorta(p.fecha)} ${p.hora}${p.canchaNombre ? ` · ${p.canchaNombre}` : ''}`;
}

// Mensaje para mandar por WhatsApp con los partidos de una fecha o ronda
export function textoRonda(detalle: DetalleTorneo, ronda: number): string {
  const nombres = new Map(detalle.equipos.map(e => [e.id, e.nombre]));
  const nombre = (id: number | null) => (id !== null ? nombres.get(id) ?? '?' : 'a definir');
  const partidos = detalle.partidos.filter(p => p.ronda === ronda && !esLibre(p));
  const lineas = partidos.map(p => {
    const resultado = p.resultadoLocal !== null ? ` ${p.resultadoLocal}-${p.resultadoVisitante}` : '';
    const cuando = textoProgramacion(p);
    return `• ${nombre(p.localId)} vs ${nombre(p.visitanteId)}${resultado}${cuando ? ` (${cuando})` : ''}`;
  });
  const titulo = nombreRonda(detalle.torneo.formato, ronda, totalRondas(detalle.partidos));
  return `🏆 ${detalle.torneo.nombre} — ${titulo}\n${lineas.join('\n')}`;
}
