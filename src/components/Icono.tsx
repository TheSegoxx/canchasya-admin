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
  | 'persona';

type Props = { nombre: NombreIcono; color: string; tamano?: number };

// Íconos de líneas dibujados con SVG (no necesitan fuentes extra)
export function Icono({ nombre, color, tamano = 24 }: Props) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {nombre === 'inicio' && (
          <>
            {/* Casa */}
            <Path d="M3 10.5 12 3l9 7.5" />
            <Path d="M5 9v12h14V9" />
            <Path d="M10 21v-6h4v6" />
          </>
        )}
        {nombre === 'grafico' && (
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
