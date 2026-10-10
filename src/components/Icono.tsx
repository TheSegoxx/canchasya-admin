import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

export type NombreIcono =
  | 'inicio'
  | 'agenda'
  | 'canchas'
  | 'mas'
  | 'agregar'
  | 'borrar'
  | 'padel'
  | 'futbol5';

type Props = { nombre: NombreIcono; color: string; tamano?: number };

// Íconos de líneas dibujados con SVG (no necesitan fuentes extra)
export function Icono({ nombre, color, tamano = 24 }: Props) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {nombre === 'inicio' && (
          <>
            <Path d="M3 3v18h18" />
            <Path d="M8 16v-4" />
            <Path d="M13 16V8" />
            <Path d="M18 16v-7" />
          </>
        )}
        {nombre === 'agenda' && (
          <>
            <Rect x={3} y={4} width={18} height={17} rx={2} />
            <Path d="M16 2v4M8 2v4M3 10h18" />
          </>
        )}
        {nombre === 'canchas' && (
          <>
            <Rect x={2} y={5} width={20} height={14} rx={1.5} />
            <Path d="M12 5v14" />
            <Circle cx={12} cy={12} r={3} />
          </>
        )}
        {nombre === 'mas' && <Path d="M4 6h16M4 12h16M4 18h16" />}
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
      </G>
    </Svg>
  );
}
