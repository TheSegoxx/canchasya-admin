import { api } from './cliente';
import type { Foto } from './fotos';

export const SERVICIOS = [
  { clave: 'vestuarios', nombre: 'Vestuarios' },
  { clave: 'duchas', nombre: 'Duchas' },
  { clave: 'buffet', nombre: 'Buffet' },
  { clave: 'estacionamiento', nombre: 'Estacionamiento' },
  { clave: 'wifi', nombre: 'Wi-Fi' },
  { clave: 'parrilla', nombre: 'Parrilla' },
] as const;

export type Servicio = (typeof SERVICIOS)[number]['clave'];

export type Ubicacion = { latitud: number; longitud: number };

export type DatosComplejo = {
  nombre: string;
  direccion: string;
  ciudad: string | null;
  ubicacion: Ubicacion | null;
  telefono: string | null;
  horaApertura: string; // "HH:MM"
  horaCierre: string; // "HH:MM", puede ser "24:00"
  servicios: Servicio[];
  // Si aparece en la búsqueda de los jugadores
  visible: boolean;
};

// Cómo toma reservas desde la app del jugador
export type ReglasReservas = {
  aceptaReservas: boolean;
  senaPorcentaje: number; // 0 = sin seña
  senaMinutos: number; // para pagar la seña antes de que se libere el horario
  reservaDias: number; // hasta cuántos días antes se puede reservar
  cancelacionHoras: number; // el jugador puede cancelar hasta estas horas antes
};

export type Complejo = DatosComplejo & { id: number; reservas: ReglasReservas };

// Endpoints /complejo de la API
export const complejoApi = {
  obtener: () => api<{ complejo: Complejo; fotos: Foto[] }>('/complejo'),
  guardar: (datos: DatosComplejo) => api<{ complejo: Complejo }>('/complejo', 'PUT', datos),
  guardarReglasReservas: (reglas: ReglasReservas) => api<{ complejo: Complejo }>('/complejo/reservas', 'PUT', reglas),
  // Las coordenadas de una dirección (con OpenStreetMap)
  buscarUbicacion: (direccion: string) =>
    api<Ubicacion & { encontrada: string }>(`/complejo/buscar-ubicacion?direccion=${encodeURIComponent(direccion)}`),
};
