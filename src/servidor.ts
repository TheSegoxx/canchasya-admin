import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Dirección del servidor (el Apache de XAMPP en la computadora).
 * - En desarrollo, con el celular por USB: "adb reverse tcp:8080 tcp:80" hace que
 *   localhost:8080 del celular llegue a la computadora.
 * - En el APK, por WiFi: la IP de la computadora en la red. Si cambia, se corrige desde
 *   el login ("Servidor") sin volver a compilar; queda guardada en el celular.
 */
export const SERVIDOR_POR_DEFECTO = __DEV__ ? 'http://localhost:8080/canchasya' : 'http://192.168.1.7/canchasya';

const CLAVE = 'canchasya.servidor';
let actual = SERVIDOR_POR_DEFECTO;

export function servidorActual(): string {
  return actual;
}

// Al abrir la app, antes de la primera petición
export async function cargarServidor(): Promise<void> {
  try {
    const guardado = await AsyncStorage.getItem(CLAVE);
    if (guardado) {
      actual = guardado;
    }
  } catch {
    // Sin almacenamiento se usa el de por defecto
  }
}

/**
 * Acepta "192.168.1.7", "192.168.1.7:8080" o una dirección completa ("http://.../canchasya").
 * Devuelve la dirección normalizada o null si no es válida.
 */
export function normalizarServidor(texto: string): string | null {
  let valor = texto.trim().replace(/\/+$/, '');
  if (!valor) {
    return null;
  }
  if (!/^https?:\/\//i.test(valor)) {
    valor = `http://${valor}`;
  }
  // Solo la IP o el nombre: se agrega la carpeta de la API en XAMPP
  if (!/^https?:\/\/[^/]+\/.+/i.test(valor)) {
    valor = `${valor}/canchasya`;
  }
  return /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?(\/[\w.-]+)+$/i.test(valor) ? valor : null;
}

export async function guardarServidor(direccion: string): Promise<void> {
  actual = direccion;
  try {
    if (direccion === SERVIDOR_POR_DEFECTO) {
      await AsyncStorage.removeItem(CLAVE);
    } else {
      await AsyncStorage.setItem(CLAVE, direccion);
    }
  } catch {
    // Si no se pudo guardar, vale hasta que se cierre la app
  }
}

// Prueba la conexión con /api/salud; devuelve true si respondió la API de CanchasYa
export async function probarServidor(direccion: string): Promise<boolean> {
  const cancelador = new AbortController();
  const temporizador = setTimeout(() => cancelador.abort(), 5000);
  try {
    const respuesta = await fetch(`${direccion}/api/salud`, { signal: cancelador.signal });
    const datos = await respuesta.json();
    return respuesta.ok && datos?.api === 'CanchasYa Admin';
  } catch {
    return false;
  } finally {
    clearTimeout(temporizador);
  }
}
