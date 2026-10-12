import { useColorScheme } from 'react-native';

/**
 * Colores de la app (verde césped) con modo claro y oscuro.
 * Semáforo de estados: libre = verde, ocupada = rojo, señado = amarillo,
 * pagado = azul, inactivo = gris.
 */
const claro = {
  fondo: '#F4F6F1',
  superficie: '#FFFFFF',
  texto: '#1B1F1B',
  textoSecundario: '#5F6B5F',
  borde: '#D7DDD3',
  primario: '#2E7D32',
  textoSobrePrimario: '#FFFFFF',
  error: '#C62828',
  libre: '#2E7D32',
  ocupada: '#C62828',
  senado: '#B7791F',
  pagado: '#1565C0',
  inactivo: '#8A8F8A',
  whatsapp: '#0B7A5E',
};

export type Colores = typeof claro;

const oscuro: Colores = {
  fondo: '#0F130F',
  superficie: '#1A201A',
  texto: '#ECF1EA',
  textoSecundario: '#A5B0A3',
  borde: '#2D362D',
  primario: '#66BB6A',
  textoSobrePrimario: '#0B1A0C',
  error: '#EF5350',
  libre: '#66BB6A',
  ocupada: '#EF5350',
  senado: '#FFCA28',
  pagado: '#64B5F6',
  inactivo: '#7A817A',
  whatsapp: '#25D366',
};

export const espaciado = { xs: 4, s: 8, m: 16, l: 24, xl: 32 };
export const radio = 12;

// Sigue el modo claro/oscuro configurado en el celular
export function useTema(): { oscuro: boolean; colores: Colores } {
  const esOscuro = useColorScheme() === 'dark';
  return { oscuro: esOscuro, colores: esOscuro ? oscuro : claro };
}
