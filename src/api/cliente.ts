import * as Keychain from 'react-native-keychain';
import { API_URL, SERVIDOR_URL, TIEMPO_ESPERA_MS } from '../config';

/**
 * Cliente HTTP de la API: agrega el token de sesión, convierte la respuesta
 * JSON y transforma los errores en mensajes claros para el dueño.
 */

const SERVICIO_TOKEN = 'canchasya.sesion';

export class ErrorApi extends Error {
  // datos: el JSON completo de la respuesta (algunos 409 traen información extra)
  constructor(mensaje: string, public status: number, public datos: any = null) {
    super(mensaje);
  }
}

// El token se guarda cifrado con el almacén seguro de Android (Keystore)
export async function guardarToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('token', token, { service: SERVICIO_TOKEN });
}

export async function leerToken(): Promise<string | null> {
  const guardado = await Keychain.getGenericPassword({ service: SERVICIO_TOKEN });
  return guardado ? guardado.password : null;
}

export async function borrarToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICIO_TOKEN });
}

// La sesión avisa por acá cuando la API rechaza el token (vencido o inválido)
let alVencerLaSesion: (() => void) | null = null;
export function siVenceLaSesion(accion: () => void): void {
  alVencerLaSesion = accion;
}

// Las fotos las sirve Apache directo; la API devuelve la ruta relativa ("fotos/abc.jpg")
export const urlDeFoto = (ruta: string) => `${SERVIDOR_URL}/${ruta}`;

// cuerpo: un objeto (se manda como JSON) o un FormData (para subir archivos)
export async function api<T>(ruta: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  const esFormulario = cuerpo instanceof FormData;
  const token = await leerToken();
  const cancelador = new AbortController();
  const temporizador = setTimeout(() => cancelador.abort(), TIEMPO_ESPERA_MS);

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: {
        // Con FormData el límite multipart lo pone fetch solo
        ...(esFormulario ? {} : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo === undefined ? undefined : esFormulario ? cuerpo : JSON.stringify(cuerpo),
      signal: cancelador.signal,
    });
  } catch {
    throw new ErrorApi(
      'No se pudo conectar con el servidor. Revisá que XAMPP esté encendido y el celular conectado.',
      0,
    );
  } finally {
    clearTimeout(temporizador);
  }

  const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);

  // Token vencido o inválido: se borra y la app vuelve al login
  if (respuesta.status === 401 && token) {
    await borrarToken();
    alVencerLaSesion?.();
  }

  if (!respuesta.ok) {
    throw new ErrorApi(datos?.error ?? `Error del servidor (${respuesta.status})`, respuesta.status, datos);
  }
  return datos as T;
}
