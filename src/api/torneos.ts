import { api } from './cliente';
import type { Deporte } from './canchas';

export type Formato = 'liga' | 'eliminacion';
export type EstadoTorneo = 'inscripcion' | 'en_curso' | 'finalizado';

export const NOMBRE_FORMATO: Record<Formato, string> = { liga: 'Liga', eliminacion: 'Eliminación directa' };
export const NOMBRE_ESTADO_TORNEO: Record<EstadoTorneo, string> = {
  inscripcion: 'Inscripción',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
};

export type Torneo = {
  id: number;
  nombre: string;
  deporte: Deporte;
  formato: Formato;
  estado: EstadoTorneo;
  equipos: number | null;
};

export type EquipoTorneo = { id: number; nombre: string; integrantes: string | null; telefono: string | null };

export type Partido = {
  id: number;
  ronda: number;
  orden: number;
  // null: libre (eliminación, primera ronda) o todavía no se sabe quién llega
  localId: number | null;
  visitanteId: number | null;
  resultadoLocal: number | null;
  resultadoVisitante: number | null;
  ganadorId: number | null;
  canchaId: number | null;
  canchaNombre: string | null;
  fecha: string | null;
  hora: string | null;
};

export type FilaTabla = {
  equipoId: number;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  aFavor: number;
  enContra: number;
  puntos: number;
};

export type DetalleTorneo = {
  torneo: Torneo;
  equipos: EquipoTorneo[];
  partidos: Partido[];
  tabla: FilaTabla[] | null; // solo en las ligas
  campeonId: number | null;
};

// Endpoints /torneos, /torneo-equipos y /partidos de la API
export const torneosApi = {
  listar: () => api<{ torneos: Torneo[] }>('/torneos'),
  crear: (datos: { nombre: string; deporte: Deporte; formato: Formato }) =>
    api<{ torneo: Torneo }>('/torneos', 'POST', datos),
  obtener: (id: number) => api<DetalleTorneo>(`/torneos/${id}`),
  borrar: (id: number) => api<null>(`/torneos/${id}`, 'DELETE'),
  agregarEquipo: (torneoId: number, datos: { nombre: string; integrantes: string; telefono: string }) =>
    api<{ equipo: EquipoTorneo }>(`/torneos/${torneoId}/equipos`, 'POST', datos),
  borrarEquipo: (id: number) => api<null>(`/torneo-equipos/${id}`, 'DELETE'),
  sortear: (id: number) => api<DetalleTorneo>(`/torneos/${id}/sorteo`, 'POST'),
  cargarResultado: (partidoId: number, local: number, visitante: number) =>
    api<DetalleTorneo>(`/partidos/${partidoId}/resultado`, 'PUT', { local, visitante }),
  borrarResultado: (partidoId: number) => api<DetalleTorneo>(`/partidos/${partidoId}/resultado`, 'DELETE'),
  programar: (partidoId: number, datos: { canchaId: number; fecha: string; hora: string }) =>
    api<DetalleTorneo>(`/partidos/${partidoId}/programacion`, 'PUT', datos),
  desprogramar: (partidoId: number) => api<DetalleTorneo>(`/partidos/${partidoId}/programacion`, 'DELETE'),
};
