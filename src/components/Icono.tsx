import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

export type NombreIcono = 'inicio' | 'agenda' | 'canchas' | 'mas';

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
      </G>
    </Svg>
  );
}
