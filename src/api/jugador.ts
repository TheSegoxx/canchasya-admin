import { api } from './cliente';
import type { Deporte } from './canchas';
import type { Ubicacion } from './complejo';

// Lista de espera: un horario ocupado que el jugador quiere si se libera
export type Espera = {
  id: number;
  complejoId: number;
  complejo: string;
  canchaId: number;
  cancha: string;
  deporte: Deporte;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  duracionMin: number;
  // Ya se le avisó que se liberó (puede que otro lo haya reservado después)
  avisada: boolean;
};

export type Nivel = 'cualquiera' | 'principiante' | 'intermedio' | 'avanzado';

export const NOMBRE_NIVEL: Record<Nivel, string> = {
  cualquiera: 'Cualquier nivel',
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

// "Me falta uno" visto por otro jugador
export type Partido = {
  id: number;
  deporte: Deporte;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  buscan: number;
  faltan: number; // lugares que quedan
  nivel: Nivel;
  comentario: string | null;
  cerrado: boolean;
  cancha: string;
  complejo: { id: number; nombre: string; direccion: string; ciudad: string | null; ubicacion: Ubicacion | null };
  organizador: string; // el nombre de pila
  sumado: boolean;
  // El celular del organizador, solo si ya se sumó
  telefonoOrganizador: string | null;
};

// Los sellos del jugador en un complejo
export type Fidelidad = {
  turnos: number; // cada cuántos turnos hay premio
  descuento: number; // % del premio (100 = gratis)
  sellos: number; // de la tarjeta que está llenando
  premios: number; // para usar
};

export type TarjetaFidelidad = Fidelidad & { complejoId: number; complejo: string };

// Pronóstico de una hora (lluvia = % de probabilidad; codigo = el de la OMM)
export type HoraClima = { hora: string; temperatura: number; lluvia: number; codigo: number };

// Endpoints de la lista de espera, los partidos que buscan jugadores, la fidelidad y el clima
export const jugadorApi = {
  esperas: () => api<{ esperas: Espera[] }>('/esperas'),
  crearEspera: (datos: { canchaId: number; fecha: string; horaInicio: string; duracionMin: number }) =>
    api<{ espera: Espera }>('/esperas', 'POST', datos),
  borrarEspera: (id: number) => api<null>(`/esperas/${id}`, 'DELETE'),
  partidos: (deporte?: Deporte) => api<{ partidos: Partido[] }>(`/partidos${deporte ? `?deporte=${deporte}` : ''}`),
  sumarme: (id: number) => api<{ partido: Partido }>(`/partidos/${id}/jugadores`, 'POST'),
  bajarme: (id: number) => api<{ partido: Partido }>(`/partidos/${id}/jugadores`, 'DELETE'),
  tarjetas: () => api<{ tarjetas: TarjetaFidelidad[] }>('/fidelidad'),
  clima: (complejoId: number, fecha: string) =>
    api<{ fecha: string; horas: HoraClima[] }>(`/complejos/${complejoId}/clima?fecha=${fecha}`),
};
