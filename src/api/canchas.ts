import { api } from './cliente';

export type Deporte = 'padel' | 'futbol5';
export type EstadoCancha = 'libre' | 'ocupada';

export const NOMBRE_DEPORTE: Record<Deporte, string> = { padel: 'Pádel', futbol5: 'Fútbol 5' };

export type DatosCancha = {
  nombre: string;
  deporte: Deporte;
  superficie: string | null;
  techada: boolean;
  duracionMin: 60 | 90;
  precioBase: number;
};

export type Cancha = DatosCancha & {
  id: number;
  estado: EstadoCancha;
  habilitada: boolean;
};

export type Franja = {
  id: number;
  horaDesde: string; // "HH:MM"
  horaHasta: string; // "HH:MM", puede ser "24:00"
  precio: number;
};

// Endpoints /canchas y /franjas de la API
export const canchasApi = {
  listar: () => api<{ canchas: Cancha[] }>('/canchas'),
  obtener: (id: number) => api<{ cancha: Cancha; franjas: Franja[] }>(`/canchas/${id}`),
  crear: (datos: DatosCancha) => api<{ cancha: Cancha }>('/canchas', 'POST', datos),
  editar: (id: number, datos: DatosCancha) => api<{ cancha: Cancha }>(`/canchas/${id}`, 'PUT', datos),
  cambiarEstado: (id: number, estado: EstadoCancha) =>
    api<{ cancha: Cancha }>(`/canchas/${id}/estado`, 'PATCH', { estado }),
  cambiarHabilitada: (id: number, habilitada: boolean) =>
    api<{ cancha: Cancha }>(`/canchas/${id}/habilitada`, 'PATCH', { habilitada }),
  crearFranja: (canchaId: number, franja: Omit<Franja, 'id'>) =>
    api<{ franja: Franja }>(`/canchas/${canchaId}/franjas`, 'POST', franja),
  borrarFranja: (id: number) => api<null>(`/franjas/${id}`, 'DELETE'),
};
