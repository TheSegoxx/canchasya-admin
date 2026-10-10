import { api } from './cliente';

export const SERVICIOS = [
  { clave: 'vestuarios', nombre: 'Vestuarios' },
  { clave: 'duchas', nombre: 'Duchas' },
  { clave: 'buffet', nombre: 'Buffet' },
  { clave: 'estacionamiento', nombre: 'Estacionamiento' },
  { clave: 'wifi', nombre: 'Wi-Fi' },
  { clave: 'parrilla', nombre: 'Parrilla' },
] as const;

export type Servicio = (typeof SERVICIOS)[number]['clave'];

export type DatosComplejo = {
  nombre: string;
  direccion: string;
  telefono: string | null;
  horaApertura: string; // "HH:MM"
  horaCierre: string; // "HH:MM", puede ser "24:00"
  servicios: Servicio[];
};

export type Complejo = DatosComplejo & { id: number };

// Endpoints /complejo de la API
export const complejoApi = {
  obtener: () => api<{ complejo: Complejo }>('/complejo'),
  guardar: (datos: DatosComplejo) => api<{ complejo: Complejo }>('/complejo', 'PUT', datos),
};
