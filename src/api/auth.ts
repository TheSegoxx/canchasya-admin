import { api } from './cliente';

export type Usuario = {
  id: number;
  nombre: string;
  email: string;
  foto: string | null;
  tienePassword: boolean;
  // El empleado (encargado) no ve el dashboard ni cambia precios
  rol: 'dueno' | 'empleado';
  tieneComplejo: boolean;
  // Nombre del complejo propio o donde trabaja
  complejo: string | null;
};

export type RespuestaSesion = {
  token: string;
  usuario: Usuario;
  nuevo?: boolean;
};

// Endpoints /auth de la API
export const authApi = {
  login: (email: string, password: string) =>
    api<RespuestaSesion>('/auth/login', 'POST', { email, password }),

  registrar: (nombre: string, email: string, password: string) =>
    api<RespuestaSesion>('/auth/register', 'POST', { nombre, email, password }),

  google: (idToken: string) => api<RespuestaSesion>('/auth/google', 'POST', { idToken }),

  // "¿Olvidaste tu contraseña?": manda un código de 6 números al email
  recuperar: (email: string) => api<{ mensaje: string }>('/auth/recuperar', 'POST', { email }),

  // Con el código correcto cambia la contraseña y devuelve la sesión
  restablecer: (email: string, codigo: string, password: string) =>
    api<RespuestaSesion>('/auth/restablecer', 'POST', { email, codigo, password }),

  yo: () => api<{ usuario: Usuario }>('/auth/yo'),
};
