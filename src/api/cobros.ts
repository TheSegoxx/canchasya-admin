import { api } from './cliente';
import type { Turno, TurnoDetalle } from './agenda';

// 'mercadopago' no se elige a mano: lo registra la API cuando se paga un link
export type MetodoPago = 'efectivo' | 'transferencia' | 'mercadopago';
export type MetodoManual = Exclude<MetodoPago, 'mercadopago'>;

export const NOMBRE_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
};

export type LinkPago = {
  id: number;
  monto: number;
  url: string;
  estado: 'pendiente' | 'pagado' | 'vencido';
  venceEn: string; // "AAAA-MM-DD HH:MM"
};

// Qué fue el pago según lo que el turno debía cuando entró (lo decide la API al registrarlo)
export type ConceptoPago = 'sena' | 'parcial' | 'saldo' | 'total';

export const NOMBRE_CONCEPTO: Record<ConceptoPago, string> = {
  sena: 'Seña',
  parcial: 'Pago parcial',
  saldo: 'Saldo',
  total: 'Pago total',
};

export type Pago = {
  id: number;
  monto: number;
  metodo: MetodoPago;
  concepto: ConceptoPago;
  fecha: string; // cuándo entró la plata
  hora: string;
};

export type Consumo = {
  id: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

export type Producto = { id: number; nombre: string; precio: number; activo: boolean };

export type NuevoConsumo = { productoId: number; cantidad: number } | { descripcion: string; precioUnitario: number; cantidad: number };

export type Caja = {
  fecha: string;
  totales: { total: number; efectivo: number; transferencia: number; mercadopago: number; cantidad: number };
  // Lo cobrado ese día, del más reciente al más viejo
  cobros: (Pago & { turno: { id: number; fecha: string; horaInicio: string; cancha: string; cliente: string } })[];
  // Turnos de ese día que todavía deben plata
  porCobrar: (Turno & { canchaNombre: string })[];
  totalPorCobrar: number;
};

// Endpoints de pagos, extras, productos y caja de la API
export const cobrosApi = {
  pagar: (turnoId: number, monto: number, metodo: MetodoManual) =>
    api<{ turno: TurnoDetalle }>(`/turnos/${turnoId}/pagos`, 'POST', { monto, metodo }),
  borrarPago: (id: number) => api<{ turno: TurnoDetalle }>(`/pagos/${id}`, 'DELETE'),
  agregarConsumo: (turnoId: number, consumo: NuevoConsumo) =>
    api<{ turno: TurnoDetalle }>(`/turnos/${turnoId}/consumos`, 'POST', consumo),
  borrarConsumo: (id: number) => api<{ turno: TurnoDetalle }>(`/consumos/${id}`, 'DELETE'),
  caja: (fecha: string) => api<Caja>(`/caja?fecha=${fecha}`),
  // Mercado Pago
  crearLink: (turnoId: number, monto: number) =>
    api<{ link: LinkPago; turno: TurnoDetalle }>(`/turnos/${turnoId}/links-pago`, 'POST', { monto }),
  verificarLinks: (turnoId: number) =>
    api<{ turno: TurnoDetalle; aviso?: string }>(`/turnos/${turnoId}/links-pago/verificar`, 'POST'),
  anularLink: (id: number) => api<{ turno: TurnoDetalle; aviso?: string }>(`/links-pago/${id}`, 'DELETE'),
  productos: () => api<{ productos: Producto[] }>('/productos'),
  crearProducto: (datos: { nombre: string; precio: number }) => api<{ producto: Producto }>('/productos', 'POST', datos),
  editarProducto: (id: number, datos: { nombre: string; precio: number; activo: boolean }) =>
    api<{ producto: Producto }>(`/productos/${id}`, 'PUT', datos),
};
