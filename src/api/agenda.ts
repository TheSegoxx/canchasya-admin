import { api } from './cliente';
import type { Cancha, Deporte, Franja } from './canchas';
import type { Consumo, LinkPago, MetodoManual, Pago } from './cobros';

export type EstadoTurno = 'confirmado' | 'cancelado' | 'jugado';
export type EstadoPago = 'pendiente' | 'senado' | 'pagado';

export type Cliente = { id: number; nombre: string; telefono: string };

export type Turno = {
  id: number;
  canchaId: number;
  fecha: string; // "AAAA-MM-DD"
  horaInicio: string; // "HH:MM"
  horaFin: string; // "HH:MM", puede ser "24:00"
  precio: number;
  estado: EstadoTurno;
  estadoPago: EstadoPago;
  // Cuenta: precio + extras; lo que falta cobrar es total - pagado
  total: number;
  pagado: number;
  turnoFijoId: number | null;
  cliente: Cliente;
};

// Lo que devuelve GET /turnos/:id
export type TurnoDetalle = Turno & {
  cancha: { id: number; nombre: string; deporte: Deporte };
  complejo: { nombre: string; direccion: string };
  fijo: { id: number; diaSemana: number; fechaHasta: string | null } | null;
  consumos: Consumo[];
  pagos: Pago[];
  linksPago: LinkPago[];
};

export type Bloqueo = {
  id: number;
  canchaId: number;
  horaDesde: string; // recortada a ese día
  horaHasta: string; // "24:00" si sigue al día siguiente
  motivo: string;
};

export type CanchaAgenda = Cancha & { franjas: Franja[] };

export type Agenda = {
  fecha: string;
  complejo: { nombre: string; direccion: string; horaApertura: string; horaCierre: string };
  canchas: CanchaAgenda[];
  turnos: Turno[];
  bloqueos: Bloqueo[];
};

export type TurnoFijo = {
  id: number;
  canchaId: number;
  canchaNombre: string;
  diaSemana: number; // 1 = lunes ... 7 = domingo
  horaInicio: string;
  horaFin: string;
  precio: number | null;
  fechaDesde: string;
  fechaHasta: string | null;
  cliente: Cliente;
};

export type NuevoTurno = {
  canchaId: number;
  fecha: string;
  horaInicio: string;
  // Sin precio, la API usa el de la franja horaria
  precio?: number;
  fijo: boolean;
  // Seña cobrada al reservar
  sena?: { monto: number; metodo: MetodoManual };
} & ({ clienteId: number } | { cliente: { nombre: string; telefono: string } });

export type NuevoBloqueo = {
  canchaIds: number[];
  fecha: string;
  horaDesde: string;
  horaHasta: string;
  motivo: string;
  cancelarTurnos?: boolean;
};

export const NOMBRE_ESTADO: Record<EstadoTurno, string> = {
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  jugado: 'Jugado',
};

export const NOMBRE_PAGO: Record<EstadoPago, string> = {
  pendiente: 'Sin pagar',
  senado: 'Señado',
  pagado: 'Pagado',
};

// Endpoints /agenda, /turnos, /turnos-fijos, /clientes y /bloqueos de la API
export const agendaApi = {
  dia: (fecha: string) => api<Agenda>(`/agenda?fecha=${fecha}`),
  crearTurno: (datos: NuevoTurno) => api<{ turno: TurnoDetalle; aviso?: string }>('/turnos', 'POST', datos),
  obtenerTurno: (id: number) => api<{ turno: TurnoDetalle }>(`/turnos/${id}`),
  cambiarEstado: (id: number, estado: EstadoTurno) =>
    api<{ turno: TurnoDetalle }>(`/turnos/${id}/estado`, 'PATCH', { estado }),
  listarFijos: () => api<{ turnosFijos: TurnoFijo[] }>('/turnos-fijos'),
  darDeBajaFijo: (id: number, desde: string) =>
    api<{ ok: true; aviso?: string }>(`/turnos-fijos/${id}/baja`, 'PATCH', { desde }),
  buscarClientes: (texto: string) =>
    api<{ clientes: Cliente[] }>(`/clientes?buscar=${encodeURIComponent(texto)}`),
  editarCliente: (id: number, datos: { nombre: string; telefono: string }) =>
    api<{ cliente: Cliente }>(`/clientes/${id}`, 'PUT', datos),
  crearBloqueo: (datos: NuevoBloqueo) => api<{ cancelados: Turno[] }>('/bloqueos', 'POST', datos),
  borrarBloqueo: (id: number) => api<null>(`/bloqueos/${id}`, 'DELETE'),
};
