import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tema elegido por el dueño: claro, oscuro o el que use el celular.
 * Se guarda en el celular y se aplica a toda la app (también a los diálogos nativos):
 * useTema() sigue funcionando igual porque lee el esquema que fija Appearance.
 */
export type PreferenciaTema = 'sistema' | 'claro' | 'oscuro';

export const NOMBRE_PREFERENCIA: Record<PreferenciaTema, string> = {
  claro: 'Claro',
  oscuro: 'Oscuro',
  sistema: 'Según el celular',
};

const CLAVE = 'canchasya.tema';

export function aplicarTema(preferencia: PreferenciaTema): void {
  Appearance.setColorScheme(preferencia === 'claro' ? 'light' : preferencia === 'oscuro' ? 'dark' : 'auto');
}

export async function leerPreferenciaTema(): Promise<PreferenciaTema> {
  try {
    const guardada = await AsyncStorage.getItem(CLAVE);
    return guardada === 'claro' || guardada === 'oscuro' ? guardada : 'sistema';
  } catch {
    return 'sistema';
  }
}

export async function guardarPreferenciaTema(preferencia: PreferenciaTema): Promise<void> {
  aplicarTema(preferencia);
  try {
    await AsyncStorage.setItem(CLAVE, preferencia);
  } catch {
    // Si no se pudo guardar, el cambio vale hasta que se cierre la app
  }
}
