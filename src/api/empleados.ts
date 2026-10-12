import { api } from './cliente';
import type { Usuario } from './auth';

export type Empleado = { id: number; nombre: string; email: string; foto: string | null };
export type Invitacion = { id: number; venceEn: string };

// Endpoints /empleados e /invitaciones de la API
export const empleadosApi = {
  listar: () => api<{ empleados: Empleado[]; invitaciones: Invitacion[] }>('/empleados'),
  quitar: (id: number) => api<null>(`/empleados/${id}`, 'DELETE'),
  // El código se muestra una sola vez: la API guarda solo su hash
  invitar: () => api<{ codigo: string; invitacion: Invitacion }>('/invitaciones', 'POST'),
  anular: (id: number) => api<null>(`/invitaciones/${id}`, 'DELETE'),
  aceptar: (codigo: string) => api<{ usuario: Usuario }>('/invitaciones/aceptar', 'POST', { codigo }),
};
