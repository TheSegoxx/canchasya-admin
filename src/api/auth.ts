import { api } from './cliente';
import type { Deporte } from './canchas';

// jugador: el cliente que reserva canchas. dueno: el dueño del complejo.
// empleado: el encargado del complejo de otro (no ve el dashboard ni cambia precios)
export type Rol = 'jugador' | 'dueno' | 'empleado';

// Los que se eligen al crear la cuenta (el encargado entra con un código del dueño)
export type RolElegible = 'jugador' | 'dueno';

export type Usuario = {
  id: number;
  nombre: string;
  email: string;
  foto: string | null;
  tienePassword: boolean;
  telefono: string | null;
  ciudad: string | null;
  deportes: Deporte[];
  rol: Rol;
  // false: entró con Google y todavía no eligió si es jugador o dueño
  rolElegido: boolean;
  tieneComplejo: boolean;
  // Nombre del complejo propio o donde trabaja
  complejo: string | null;
};

export type RespuestaSesion = {
  token: string;
  usuario: Usuario;
  nuevo?: boolean;
};

// Datos personales que se piden al crear la cuenta y se editan en "Mis datos"
export type DatosPerfil = {
  nombre: string;
  telefono: string;
  ciudad?: string;
  // Solo jugadores
  deportes?: Deporte[];
};

export type DatosRegistro = DatosPerfil & { rol: RolElegible; email: string; password: string };

// Endpoints /auth de la API
export const authApi = {
  login: (email: string, password: string) =>
    api<RespuestaSesion>('/auth/login', 'POST', { email, password }),

  registrar: (datos: DatosRegistro) => api<RespuestaSesion>('/auth/register', 'POST', datos),

  google: (idToken: string) => api<RespuestaSesion>('/auth/google', 'POST', { idToken }),

  // "¿Olvidaste tu contraseña?": manda un código de 6 números al email
  recuperar: (email: string) => api<{ mensaje: string }>('/auth/recuperar', 'POST', { email }),

  // Con el código correcto cambia la contraseña y devuelve la sesión
  restablecer: (email: string, codigo: string, password: string) =>
    api<RespuestaSesion>('/auth/restablecer', 'POST', { email, codigo, password }),

  yo: () => api<{ usuario: Usuario }>('/auth/yo'),

  // El rol solo se manda una vez: la primera vez que entra con Google
  guardarPerfil: (datos: DatosPerfil & { rol?: RolElegible }) =>
    api<{ usuario: Usuario }>('/auth/perfil', 'PUT', datos),
};
