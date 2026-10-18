import { api } from './cliente';
import type { Deporte, Franja } from './canchas';
import type { ReglasReservas, Servicio, Ubicacion } from './complejo';

// Un complejo en la lista de búsqueda del jugador
export type ComplejoResumen = {
  id: number;
  nombre: string;
  direccion: string;
  ciudad: string | null;
  ubicacion: Ubicacion | null;
  // Solo si se buscó "cerca mío" y el complejo cargó su ubicación
  distanciaKm: number | null;
  foto: string | null; // ruta de la portada
  deportes: Deporte[];
  canchas: number;
  // El precio más bajo por hora (de las canchas del deporte buscado)
  precioHoraDesde: number;
  horaApertura: string;
  horaCierre: string;
  favorito: boolean;
};

export type CanchaFicha = {
  id: number;
  nombre: string;
  deporte: Deporte;
  superficie: string | null;
  techada: boolean;
  duracionMin: number;
  precioBase: number; // por turno (lo que dura la cancha)
  franjas: Franja[];
  fotos: string[];
};

// La ficha del complejo
export type ComplejoFicha = {
  id: number;
  nombre: string;
  direccion: string;
  ciudad: string | null;
  ubicacion: Ubicacion | null;
  telefono: string | null;
  horaApertura: string;
  horaCierre: string;
  servicios: Servicio[];
  fotos: string[];
  favorito: boolean;
  // Si toma reservas por la app, la seña y los plazos
  reservas: ReglasReservas;
  canchas: CanchaFicha[];
};

export type FiltrosBusqueda = {
  buscar?: string;
  deporte?: Deporte;
  favoritos?: boolean;
  desde?: Ubicacion; // para ordenar por distancia
};

function consulta(f: FiltrosBusqueda): string {
  const partes: string[] = [];
  if (f.buscar?.trim()) {
    partes.push(`buscar=${encodeURIComponent(f.buscar.trim())}`);
  }
  if (f.deporte) {
    partes.push(`deporte=${f.deporte}`);
  }
  if (f.favoritos) {
    partes.push('favoritos=1');
  }
  if (f.desde) {
    partes.push(`lat=${f.desde.latitud}`, `lng=${f.desde.longitud}`);
  }
  return partes.length > 0 ? `?${partes.join('&')}` : '';
}

// "a 800 m", "a 3,4 km"
export function textoDistancia(km: number): string {
  return km < 1 ? `a ${Math.round(km * 1000)} m` : `a ${km.toFixed(1).replace('.', ',')} km`;
}

// Endpoints /complejos de la API (lo que ve el jugador)
export const explorarApi = {
  buscar: (filtros: FiltrosBusqueda) => api<{ complejos: ComplejoResumen[] }>(`/complejos${consulta(filtros)}`),
  ficha: (id: number) => api<{ complejo: ComplejoFicha }>(`/complejos/${id}`),
  favorito: (id: number, es: boolean) => api<{ favorito: boolean }>(`/complejos/${id}/favorito`, es ? 'PUT' : 'DELETE'),
};
