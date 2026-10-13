import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

export type NombreIcono =
  | 'inicio'
  | 'grafico'
  | 'agenda'
  | 'canchas'
  | 'mas'
  | 'agregar'
  | 'borrar'
  | 'padel'
  | 'futbol5'
  | 'whatsapp'
  | 'telefono'
  | 'repetir'
  | 'candado'
  | 'anterior'
  | 'siguiente'
  | 'lista'
  | 'grilla'
  | 'persona'
  | 'clientes'
  | 'complejo'
  | 'empleados'
  | 'productos'
  | 'torneos'
  | 'turnosFijos'
  | 'temaClaro'
  | 'temaOscuro'
  | 'temaDispositivo';

type Props = {
  nombre: NombreIcono;
  // Color de las líneas
  color: string;
  // Color de los detalles (el verde de la marca); si no se pasa, todo va del mismo color
  acento?: string;
  tamano?: number;
};

/**
 * Íconos de líneas dibujados con SVG (no necesitan fuentes extra).
 * Los de navegación y del menú son los del diseño (assets/diseño/*.svg): línea + detalle en verde.
 */
export function Icono({ nombre, color, acento = color, tamano = 24 }: Props) {
  // Detalle relleno o con trazo más grueso, en el color de acento
  const relleno = { fill: acento, stroke: acento };
  const trazo = { stroke: acento };
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {nombre === 'inicio' && (
          <>
            {/* Casa con la puerta en verde */}
            <Path d="M3.5 10.8 12 3.8l8.5 7" />
            <Path d="M5.5 9.7v10.1h13V9.7" />
            <Path d="M9.3 19.8v-6.1h5.4v6.1" {...relleno} />
          </>
        )}
        {nombre === 'grafico' && (
          <>
            <Path d="M3.5 20.3h17" />
            <Rect x={5} y={12.2} width={3.2} height={6.2} rx={0.8} {...relleno} />
            <Rect x={10.4} y={8.5} width={3.2} height={9.9} rx={0.8} {...relleno} />
            <Rect x={15.8} y={4.2} width={3.2} height={14.2} rx={0.8} {...relleno} />
          </>
        )}
        {nombre === 'agenda' && (
          <>
            <Rect x={3.5} y={5.2} width={17} height={15.3} rx={2} />
            <Path d="M7.5 3.4v4M16.5 3.4v4M3.8 9.2h16.4" />
            <Path d="M7.6 12.3h2M14.3 12.3h2M7.6 16.1h2M14.3 16.1h2" {...trazo} strokeWidth={2.2} />
          </>
        )}
        {nombre === 'canchas' && (
          <>
            <Rect x={2.7} y={3.8} width={18.6} height={16.4} rx={1.8} />
            <Path d="M12 4v16M3.1 12h17.8" />
            <Circle cx={12} cy={12} r={2.6} />
            <Path d="M4.2 8h2.2v8H4.2M17.6 8h2.2v8h-2.2" {...trazo} />
          </>
        )}
        {nombre === 'mas' && (
          <>
            <Circle cx={5} cy={12} r={1.5} {...relleno} />
            <Circle cx={12} cy={12} r={1.5} {...relleno} />
            <Circle cx={19} cy={12} r={1.5} {...relleno} />
          </>
        )}
        {nombre === 'clientes' && (
          <>
            <Circle cx={12} cy={7.3} r={3} {...relleno} />
            <Path d="M6.3 19.9v-1.1a5.7 5.7 0 0 1 11.4 0v1.1Z" {...relleno} />
            <Circle cx={4.8} cy={9.1} r={2.1} />
            <Path d="M1.8 18.2v-.7a3.8 3.8 0 0 1 3.8-3.8M19.2 9.1a2.1 2.1 0 1 0 0-.1M18.4 13.7a3.8 3.8 0 0 1 3.8 3.8v.7" />
          </>
        )}
        {nombre === 'complejo' && (
          <>
            <Path d="M3 20.5h18" />
            <Rect x={4.3} y={8.3} width={6.2} height={12.2} rx={0.6} />
            <Rect x={12} y={3.5} width={7.7} height={17} rx={0.6} />
            <Path
              d="M6.2 11h1.1M6.2 14h1.1M6.2 17h1.1M14.4 6.5h1.2M17 6.5h1.2M14.4 10h1.2M17 10h1.2M14.4 13.5h1.2M17 13.5h1.2M14.4 17h1.2M17 17h1.2"
              {...trazo}
            />
          </>
        )}
        {nombre === 'empleados' && (
          <>
            <Circle cx={12} cy={7.2} r={3.4} {...relleno} />
            <Path d="M4.1 20.5v-1.4a7.9 7.9 0 0 1 15.8 0v1.4Z" {...relleno} />
          </>
        )}
        {nombre === 'productos' && (
          <>
            <Path d="m12 2.8 8.7 4.8v9L12 21.2l-8.7-4.6v-9Z" />
            <Path d="m3.5 7.7 8.5 4.8 8.5-4.8M12 12.5v8.1" />
            <Path d="m7.7 5.2 8.7 4.9" {...trazo} strokeWidth={2.2} />
          </>
        )}
        {nombre === 'torneos' && (
          <>
            <Path d="M7 3.5h10v4.1a5 5 0 0 1-10 0Z" />
            <Path d="M7 5H3.5v2a4.5 4.5 0 0 0 4.1 4.5M17 5h3.5v2a4.5 4.5 0 0 1-4.1 4.5M12 12.6v4.1M8.7 20.5h6.6M10 16.7h4v3.8h-4Z" />
            <Path d="M9.5 6.3h5" {...trazo} strokeWidth={2.2} />
          </>
        )}
        {nombre === 'turnosFijos' && (
          <>
            <Rect x={3.2} y={4.8} width={14.2} height={15.7} rx={1.8} />
            <Path d="M7 2.8v4M13.6 2.8v4M3.5 8.7h13.6" />
            <Circle cx={17.8} cy={17.7} r={4.1} />
            <Path d="M17.8 15.5v2.4l1.6 1" {...trazo} />
          </>
        )}
        {nombre === 'temaClaro' && (
          <>
            <Circle cx={12} cy={12} r={3.5} {...relleno} />
            <Path d="M12 2.5v2.1M12 19.4v2.1M2.5 12h2.1M19.4 12h2.1M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5" />
          </>
        )}
        {nombre === 'temaOscuro' && <Path d="M19.7 14.5A8.1 8.1 0 0 1 9.5 4.3 8.4 8.4 0 1 0 19.7 14.5Z" {...relleno} />}
        {nombre === 'temaDispositivo' && (
          <>
            <Rect x={6.2} y={2.2} width={11.6} height={19.6} rx={2.1} />
            <Path d="M9 5h6M10.5 18.5h3" {...trazo} />
            <Circle cx={12} cy={18.5} r={0.6} {...relleno} />
          </>
        )}
        {nombre === 'agregar' && <Path d="M12 5v14M5 12h14" />}
        {nombre === 'borrar' && (
          <>
            <Path d="M4 7h16M10 11v6M14 11v6" />
            <Path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
          </>
        )}
        {nombre === 'padel' && (
          <>
            {/* Paleta con agujeros y mango */}
            <Path d="M14.5 3a6 6 0 0 1 0 12 6 6 0 0 1 0-12z" />
            <Path d="M10.3 13.7 4 20" />
            <Circle cx={13} cy={8} r={0.6} />
            <Circle cx={16} cy={8} r={0.6} />
            <Circle cx={14.5} cy={11} r={0.6} />
          </>
        )}
        {nombre === 'futbol5' && (
          <>
            {/* Pelota */}
            <Circle cx={12} cy={12} r={9} />
            <Path d="M12 7.5l3.3 2.4-1.3 3.9h-4l-1.3-3.9z" />
            <Path d="M12 7.5V3.5M15.3 9.9l3.6-1.4M14 13.8l2.2 3.4M10 13.8l-2.2 3.4M8.7 9.9 5.1 8.5" />
          </>
        )}
        {nombre === 'whatsapp' && (
          <>
            {/* Globo de chat con un tubo de teléfono */}
            <Path d="M3 21l1.6-4.5A8.5 8.5 0 1 1 7.7 19.4L3 21z" />
            <Path d="M9 9.2c.3 2.9 2.6 5.3 5.6 5.7l1.1-1.3-1.9-1-.9.7a4.4 4.4 0 0 1-2.1-2.1l.7-.9-1-1.9L9 9.2z" />
          </>
        )}
        {nombre === 'telefono' && (
          <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
        )}
        {nombre === 'repetir' && (
          <>
            <Path d="M17 2l4 4-4 4" />
            <Path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <Path d="M7 22l-4-4 4-4" />
            <Path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </>
        )}
        {nombre === 'candado' && (
          <>
            <Rect x={5} y={11} width={14} height={10} rx={2} />
            <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </>
        )}
        {nombre === 'anterior' && <Path d="M15 18l-6-6 6-6" />}
        {nombre === 'siguiente' && <Path d="M9 18l6-6-6-6" />}
        {nombre === 'lista' && <Path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />}
        {nombre === 'grilla' && (
          <>
            <Rect x={3} y={3} width={18} height={18} rx={2} />
            <Path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
          </>
        )}
        {nombre === 'persona' && (
          <>
            <Circle cx={12} cy={8} r={4} />
            <Path d="M4 21a8 8 0 0 1 16 0" />
          </>
        )}
      </G>
    </Svg>
  );
}
