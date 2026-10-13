import { PermissionsAndroid, Platform } from 'react-native';
import {
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import type { RemoteMessage } from '@react-native-firebase/messaging';
import { api } from './api/cliente';

/**
 * Notificaciones push con Firebase Cloud Messaging. La API las manda a la gente del
 * complejo (turnos nuevos o cancelados, pagos, recordatorios, resumen de caja).
 * Si el celular no tiene Google Play Services o no hay conexión, la app sigue igual sin ellas.
 */

export type Aviso = {
  titulo: string;
  cuerpo: string;
  // Qué abrir al tocarla
  turnoId: number | null;
  pantalla: string | null;
};

export function avisoDe(mensaje: RemoteMessage): Aviso {
  const datos = mensaje.data ?? {};
  const turnoId = Number(datos.turnoId);
  return {
    titulo: mensaje.notification?.title ?? '',
    cuerpo: mensaje.notification?.body ?? '',
    turnoId: Number.isInteger(turnoId) && turnoId > 0 ? turnoId : null,
    pantalla: typeof datos.pantalla === 'string' ? datos.pantalla : null,
  };
}

// Con la app cerrada las muestra Android solo; esto evita la advertencia de Firebase
// por no tener quién reciba el mensaje en segundo plano
export function registrarManejadorEnSegundoPlano(): void {
  setBackgroundMessageHandler(getMessaging(), async () => undefined);
}

let tokenActual: string | null = null;
let dejarDeEscucharToken: (() => void) | null = null;

const registrar = (token: string) => api('/dispositivos', 'POST', { token });

// Con sesión iniciada: pide el permiso (Android 13 o superior) y registra el celular en la API
export async function activarNotificaciones(): Promise<void> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const respuesta = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (respuesta !== PermissionsAndroid.RESULTS.GRANTED) {
        return;
      }
    }
    const messaging = getMessaging();
    tokenActual = await getToken(messaging);
    await registrar(tokenActual);
    // Firebase cambia el token cada tanto: se vuelve a registrar
    dejarDeEscucharToken?.();
    dejarDeEscucharToken = onTokenRefresh(messaging, nuevo => {
      tokenActual = nuevo;
      registrar(nuevo).catch(() => undefined);
    });
  } catch {
    // Sin Google Play Services o sin conexión: la app funciona igual
  }
}

// Al cerrar sesión (antes de borrar el token de sesión): ese celular deja de recibir avisos de la cuenta.
// Si el servidor no contesta en unos segundos, se sigue igual.
export async function desactivarNotificaciones(): Promise<void> {
  dejarDeEscucharToken?.();
  dejarDeEscucharToken = null;
  const token = tokenActual;
  tokenActual = null;
  if (!token) {
    return;
  }
  const espera = new Promise<void>(resolver => setTimeout(resolver, 3000));
  await Promise.race([api('/dispositivos/baja', 'POST', { token }).catch(() => undefined), espera]);
}

/**
 * alLlegar: llegó una con la app abierta (Android no la muestra: la muestra la app).
 * alTocar: se tocó una en la barra de notificaciones, con la app en segundo plano o cerrada.
 */
export function escucharNotificaciones(alLlegar: (aviso: Aviso) => void, alTocar: (aviso: Aviso) => void): () => void {
  const messaging = getMessaging();
  const quitarLlegada = onMessage(messaging, mensaje => alLlegar(avisoDe(mensaje)));
  const quitarToque = onNotificationOpenedApp(messaging, mensaje => alTocar(avisoDe(mensaje)));
  // La app estaba cerrada y se abrió tocando la notificación
  getInitialNotification(messaging)
    .then(mensaje => mensaje && alTocar(avisoDe(mensaje)))
    .catch(() => undefined);
  return () => {
    quitarLlegada();
    quitarToque();
  };
}
