import { api } from './cliente';
import type { Deporte } from './canchas';
import type { LinkPago } from './cobros';
import type { ReglasReservas, Ubicacion } from './complejo';
import type { EstadoPago, EstadoTurno } from './agenda';

// Un horario que el jugador no puede tomar (sin decir de quién es)
export type Ocupado = { canchaId: number; horaDesde: string; horaHasta: string };

// GET /complejos/:id/disponibilidad
export type Disponibilidad = {
  fecha: string;
  horaApertura: string;
  horaCierre: string;
  // Solo si es hoy: lo que ya empezó no se puede reservar
  ahora: string | null;
  reservas: ReglasReservas;
  ocupados: Ocupado[];
};

// Cómo paga al reservar: la seña o el total por Mercado Pago, o todo en el complejo (si no pide seña)
export type FormaDePago = 'sena' | 'total' | 'complejo';

export type DatosReserva = {
  canchaId: number;
  fecha: string;
  horaInicio: string;
  duracionMin: number;
  pago: FormaDePago;
  telefono?: string; // si la cuenta todavía no tiene celular
};

// Una reserva como la ve el jugador
export type Reserva = {
  id: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  duracionMin: number;
  estado: EstadoTurno;
  estadoPago: EstadoPago;
  precio: number;
  total: number; // precio + extras que haya cargado el complejo
  pagado: number;
  saldo: number;
  sena: number | null;
  // Mientras falte pagar la seña la reserva es provisoria: si vence, se cancela sola
  senaPendiente: boolean;
  senaVenceEn: string | null; // "AAAA-MM-DD HH:MM"
  terminada: boolean;
  puedeCancelar: boolean;
  cancelableHasta: string; // "AAAA-MM-DD HH:MM"
  cancelacionHoras: number;
  // El link de Mercado Pago que está esperando el pago, si hay uno
  linkPago: LinkPago | null;
  complejo: {
    id: number;
    nombre: string;
    direccion: string;
    ciudad: string | null;
    telefono: string | null;
    ubicacion: Ubicacion | null;
  };
  cancha: { id: number; nombre: string; deporte: Deporte };
};

// Endpoints /reservas de la API (y la disponibilidad de un complejo)
export const reservasApi = {
  disponibilidad: (complejoId: number, fecha: string) =>
    api<Disponibilidad>(`/complejos/${complejoId}/disponibilidad?fecha=${fecha}`),
  crear: (datos: DatosReserva) => api<{ reserva: Reserva; link?: LinkPago; aviso?: string }>('/reservas', 'POST', datos),
  listar: () => api<{ proximas: Reserva[]; anteriores: Reserva[] }>('/reservas'),
  obtener: (id: number) => api<{ reserva: Reserva }>(`/reservas/${id}`),
  // El link de Mercado Pago por la seña o por todo lo que falta
  pagar: (id: number, que: 'sena' | 'saldo') =>
    api<{ link: LinkPago; reserva: Reserva }>(`/reservas/${id}/pago`, 'POST', { que }),
  verificarPago: (id: number) => api<{ pagado: boolean; reserva: Reserva }>(`/reservas/${id}/verificar-pago`, 'POST'),
  cancelar: (id: number) => api<{ reserva: Reserva; aviso?: string }>(`/reservas/${id}/cancelar`, 'POST'),
};
