import { useColorScheme } from 'react-native';

/**
 * Colores de la marca CanchasYa (azul del logo y verde) con modo claro y oscuro.
 * Semáforo de estados: libre = verde, ocupada = rojo, señado = amarillo,
 * pagado = azul, inactivo = gris. Contrastes de texto de 4,5:1 o más.
 */
const claro = {
  fondo: '#F5F7F9',
  superficie: '#FFFFFF',
  texto: '#0F2233',
  textoSecundario: '#5A6B7B',
  borde: '#E2E8EE',
  primario: '#0A8058',
  textoSobrePrimario: '#FFFFFF',
  // Verde de los íconos (detalles de color, no texto)
  acento: '#18B982',
  error: '#D32F2F',
  libre: '#0A8058',
  ocupada: '#D32F2F',
  senado: '#B7791F',
  pagado: '#1565C0',
  inactivo: '#8A96A3',
  whatsapp: '#0B7A5E',
  // Series de los gráficos (validadas para daltonismo sobre la superficie)
  serieIngresos: '#2A78D6',
  serieEgresos: '#EB6834',
};

export type Colores = typeof claro;

const oscuro: Colores = {
  fondo: '#071928',
  superficie: '#0F2436',
  texto: '#E8EFF5',
  textoSecundario: '#93A6B8',
  borde: '#1E3549',
  primario: '#1FCB8A',
  textoSobrePrimario: '#05261A',
  acento: '#1FCB8A',
  error: '#EF5350',
  libre: '#1FCB8A',
  ocupada: '#EF5350',
  senado: '#FFCA28',
  pagado: '#64B5F6',
  inactivo: '#6F8293',
  whatsapp: '#25D366',
  serieIngresos: '#3987E5',
  serieEgresos: '#D95926',
};

// Azul del logo: pantalla de carga e ícono (igual en los dos modos)
export const AZUL_MARCA = '#071928';
export const VERDE_MARCA = '#18B982';

// Fuente de toda la app (res/font/inter.xml en Android); el peso se elige con fontWeight
export const FUENTE = 'Inter';

export const espaciado = { xs: 4, s: 8, m: 16, l: 24, xl: 32 };
export const radio = 10;

// Sigue el modo claro/oscuro configurado en el celular
export function useTema(): { oscuro: boolean; colores: Colores } {
  const esOscuro = useColorScheme() === 'dark';
  return { oscuro: esOscuro, colores: esOscuro ? oscuro : claro };
}
