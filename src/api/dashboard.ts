import { api } from './cliente';
import type { MetodoManual } from './cobros';

export type TipoMovimiento = 'ingreso' | 'egreso';

// Las claves las valida la API; acá están los nombres para mostrar
export const CATEGORIAS: Record<TipoMovimiento, { clave: string; nombre: string }[]> = {
  egreso: [
    { clave: 'sueldos', nombre: 'Sueldos' },
    { clave: 'servicios', nombre: 'Luz, agua y gas' },
    { clave: 'alquiler', nombre: 'Alquiler' },
    { clave: 'mantenimiento', nombre: 'Mantenimiento' },
    { clave: 'compras', nombre: 'Compras y mercadería' },
    { clave: 'impuestos', nombre: 'Impuestos' },
    { clave: 'otros', nombre: 'Otros gastos' },
  ],
  ingreso: [
    { clave: 'ventas', nombre: 'Ventas de mostrador' },
    { clave: 'eventos', nombre: 'Eventos' },
    { clave: 'otros', nombre: 'Otros ingresos' },
  ],
};

export const nombreCategoria = (tipo: TipoMovimiento, clave: string) =>
  CATEGORIAS[tipo].find(c => c.clave === clave)?.nombre ?? clave;

// Parte del monto de un movimiento que va a una categoría
export type ParteCategoria = { categoria: string; monto: number };

export type Movimiento = {
  id: number;
  tipo: TipoMovimiento;
  // La principal (la de mayor monto)
  categoria: string;
  // Cómo se reparte el monto (suman el monto); de mayor a menor
  categorias: ParteCategoria[];
  descripcion: string | null;
  monto: number;
  metodo: MetodoManual;
  fecha: string;
};

export type NuevoMovimiento = Pick<Movimiento, 'tipo' | 'categorias' | 'descripcion' | 'metodo' | 'fecha'>;

// "Compras y mercadería + Mantenimiento"
export const nombresCategorias = (m: Pick<Movimiento, 'tipo' | 'categoria' | 'categorias'>) =>
  (m.categorias.length > 0 ? m.categorias.map(c => c.categoria) : [m.categoria])
    .map(c => nombreCategoria(m.tipo, c))
    .join(' + ');

export type Resumen = {
  desde: string;
  hasta: string;
  agrupacion: 'dia' | 'mes';
  ingresos: { total: number; turnos: number; otros: number };
  egresos: number;
  balance: number;
  // Ingresos menos egresos de cada medio de pago
  billetera: { efectivo: number; transferencia: number; mercadopago: number };
  // Una entrada por día ("AAAA-MM-DD") o por mes ("AAAA-MM")
  serie: { clave: string; ingresos: number; egresos: number }[];
  egresosPorCategoria: { categoria: string; monto: number }[];
  otrosIngresosPorCategoria: { categoria: string; monto: number }[];
  ingresosPorCancha: { canchaId: number; nombre: string; monto: number }[];
  // ocupacion: 0 a 1 sobre los días que ya pasaron; null si el período es futuro
  turnos: { reservados: number; cancelados: number; ocupacion: number | null };
};

// Endpoints /dashboard y /movimientos de la API
export const dashboardApi = {
  resumen: (desde: string, hasta: string) => api<Resumen>(`/dashboard?desde=${desde}&hasta=${hasta}`),
  movimientos: (desde: string, hasta: string) =>
    api<{ movimientos: Movimiento[] }>(`/movimientos?desde=${desde}&hasta=${hasta}`),
  crearMovimiento: (datos: NuevoMovimiento) => api<{ movimiento: Movimiento }>('/movimientos', 'POST', datos),
  borrarMovimiento: (id: number) => api<null>(`/movimientos/${id}`, 'DELETE'),
};
