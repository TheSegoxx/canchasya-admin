import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { authApi, RespuestaSesion, Usuario } from '../api/auth';
import { borrarToken, ErrorApi, guardarToken, leerToken, siPierdeElComplejo, siVenceLaSesion } from '../api/cliente';
import { GOOGLE_WEB_CLIENT_ID } from '../config';

// webClientId hace que Google entregue un idToken firmado para nuestra API
GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

type Sesion = {
  cargando: boolean;
  usuario: Usuario | null;
  // Hay sesión guardada pero el servidor no respondió al abrir la app
  sinConexion: boolean;
  reintentar: () => void;
  entrarConEmail: (email: string, password: string) => Promise<void>;
  registrarse: (nombre: string, email: string, password: string) => Promise<void>;
  // Devuelve false si el dueño cerró la ventana de Google sin elegir cuenta
  entrarConGoogle: () => Promise<boolean>;
  cerrarSesion: () => Promise<void>;
  actualizarUsuario: (usuario: Usuario) => void;
};

const SesionContext = createContext<Sesion | null>(null);

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [sinConexion, setSinConexion] = useState(false);

  // Si hay un token guardado, se recupera la sesión
  const recuperarSesion = useCallback(async () => {
    setCargando(true);
    setSinConexion(false);
    try {
      if (await leerToken()) {
        const respuesta = await authApi.yo();
        setUsuario(respuesta.usuario);
      }
    } catch (e) {
      // Token vencido (401): el cliente ya lo borró y se muestra el login.
      // Servidor apagado o con error: se conserva la sesión y se ofrece reintentar.
      if (!(e instanceof ErrorApi) || e.status !== 401) {
        setSinConexion(true);
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    siVenceLaSesion(() => setUsuario(null));
    // Se vuelven a pedir los datos de la cuenta: la navegación pasa sola a Configurar complejo
    siPierdeElComplejo(() => {
      authApi
        .yo()
        .then(respuesta => setUsuario(respuesta.usuario))
        .catch(() => undefined);
    });
    recuperarSesion();
  }, [recuperarSesion]);

  const iniciar = useCallback(async (respuesta: RespuestaSesion) => {
    await guardarToken(respuesta.token);
    setUsuario(respuesta.usuario);
  }, []);

  const entrarConEmail = useCallback(
    async (email: string, password: string) => iniciar(await authApi.login(email, password)),
    [iniciar],
  );

  const registrarse = useCallback(
    async (nombre: string, email: string, password: string) =>
      iniciar(await authApi.registrar(nombre, email, password)),
    [iniciar],
  );

  const entrarConGoogle = useCallback(async () => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const respuesta = await GoogleSignin.signIn();
    if (!isSuccessResponse(respuesta)) {
      return false;
    }
    try {
      const { idToken } = respuesta.data;
      if (!idToken) {
        throw new Error('Google no devolvió el token. Revisá el ID de cliente web en config.ts.');
      }
      // La API verifica el token con Google y devuelve nuestra propia sesión (JWT)
      await iniciar(await authApi.google(idToken));
      return true;
    } catch (e) {
      // Si nuestra API rechazó la cuenta, se cierra también en Google
      // para que el próximo intento deje elegir otra
      await GoogleSignin.signOut().catch(() => undefined);
      throw e;
    }
  }, [iniciar]);

  const cerrarSesion = useCallback(async () => {
    try {
      await borrarToken();
      // Así la próxima vez Google vuelve a preguntar qué cuenta usar
      await GoogleSignin.signOut().catch(() => undefined);
    } finally {
      setSinConexion(false);
      setUsuario(null);
    }
  }, []);

  const valor = useMemo(
    () => ({
      cargando,
      usuario,
      sinConexion,
      reintentar: recuperarSesion,
      entrarConEmail,
      registrarse,
      entrarConGoogle,
      cerrarSesion,
      actualizarUsuario: setUsuario,
    }),
    [cargando, usuario, sinConexion, recuperarSesion, entrarConEmail, registrarse, entrarConGoogle, cerrarSesion],
  );

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion(): Sesion {
  const sesion = useContext(SesionContext);
  if (!sesion) {
    throw new Error('useSesion debe usarse dentro de <SesionProvider>');
  }
  return sesion;
}

// El dueño puede todo; el empleado no ve el dashboard ni cambia precios
export function useEsDueno(): boolean {
  return useSesion().usuario?.rol !== 'empleado';
}

// Convierte cualquier error en un mensaje entendible para el dueño
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorApi) {
    return error.message;
  }
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.IN_PROGRESS:
        return 'Ya hay un inicio de sesión en curso.';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Este celular no tiene Google Play Services actualizado.';
      case '10':
        return 'Error de configuración de Google (DEVELOPER_ERROR): revisá el paquete y la huella SHA-1 en Google Cloud.';
      default:
        return `No se pudo iniciar sesión con Google (código ${error.code}).`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Ocurrió un error inesperado.';
}
