import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { Ubicacion } from './api/complejo';

/**
 * Ubicación actual del celular (para cargar dónde queda el complejo estando ahí).
 * Pide el permiso la primera vez. Rechaza con un mensaje para mostrar.
 */
export async function ubicacionActual(): Promise<Ubicacion> {
  if (Platform.OS === 'android') {
    const respuesta = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Ubicación del complejo',
      message: 'Para guardar dónde queda tu complejo, CanchasYa necesita la ubicación de este celular (solo ahora).',
      buttonPositive: 'Permitir',
      buttonNegative: 'Ahora no',
    });
    if (respuesta !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Sin permiso de ubicación. Podés buscarla con la dirección.');
    }
  }
  // Primero con el GPS; si tarda (por ejemplo, bajo techo), con la red (WiFi o antena), que es menos precisa
  try {
    return await posicion(true, 15000);
  } catch (e) {
    if ((e as { code?: number }).code !== 3) {
      throw new Error('No se pudo obtener la ubicación. Revisá que la ubicación del celular esté activada.');
    }
  }
  try {
    return await posicion(false, 15000);
  } catch {
    throw new Error('No se pudo obtener la ubicación. Probá al aire libre o buscala con la dirección.');
  }
}

// code 3 = se agotó el tiempo
function posicion(gps: boolean, espera: number): Promise<Ubicacion> {
  return new Promise((resolver, rechazar) =>
    Geolocation.getCurrentPosition(
      ({ coords }) =>
        resolver({ latitud: Math.round(coords.latitude * 1e6) / 1e6, longitud: Math.round(coords.longitude * 1e6) / 1e6 }),
      rechazar,
      { enableHighAccuracy: gps, timeout: espera, maximumAge: 5 * 60000 },
    ),
  );
}
