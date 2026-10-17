import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { Text } from './Texto';
import { AZUL_MARCA, VERDE_MARCA } from '../theme/tema';

type Props = {
  // La sesión y el tema ya cargaron: cuando termina la animación, se va
  listo: boolean;
  alTerminar: () => void;
};

// Tiempo mínimo en pantalla, para que la animación se vea completa aunque todo cargue al instante
const DURACION_MINIMA_MS = 1600;
const ANCHO_SIMBOLO = 150;

/**
 * Pantalla de carga con el diseño de assets/diseño/splash-screen-mockup.png.
 * Arranca igual que la del sistema (el símbolo centrado sobre el azul de la marca),
 * así el cambio no se nota; después sube el logo y aparecen el nombre y la barra de progreso.
 */
export function PantallaDeCarga({ listo, alTerminar }: Props) {
  const { width, height } = useWindowDimensions();
  const entrada = useRef(new Animated.Value(0)).current;
  const progreso = useRef(new Animated.Value(0)).current;
  const salida = useRef(new Animated.Value(1)).current;
  const [minimoCumplido, setMinimoCumplido] = useState(false);

  useEffect(() => {
    Animated.timing(entrada, {
      toValue: 1,
      duration: 700,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // La barra avanza hasta el 85 % sola y completa cuando todo está listo
    Animated.timing(progreso, {
      toValue: 0.85,
      duration: DURACION_MINIMA_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    const temporizador = setTimeout(() => setMinimoCumplido(true), DURACION_MINIMA_MS);
    return () => clearTimeout(temporizador);
  }, [entrada, progreso]);

  useEffect(() => {
    if (!listo || !minimoCumplido) {
      return;
    }
    Animated.sequence([
      Animated.timing(progreso, { toValue: 1, duration: 250, useNativeDriver: false }),
      Animated.timing(salida, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start(() => alTerminar());
  }, [listo, minimoCumplido, progreso, salida, alTerminar]);

  const subir = entrada.interpolate({ inputRange: [0, 1], outputRange: [0, -110] });
  const achicar = entrada.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });
  const aparecer = entrada.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });
  const deslizar = entrada.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const anchoBarra = progreso.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Cargando CanchasYa"
      style={[StyleSheet.absoluteFill, estilos.fondo, { opacity: salida }]}>
      <Fondo ancho={width} alto={height} />

      <View style={estilos.centro}>
        <Animated.View style={{ transform: [{ translateY: subir }, { scale: achicar }] }}>
          <Image
            source={require('../../assets/app/simbolo.png')}
            style={estilos.simbolo}
            // Sin el fundido de Android: tiene que verse igual que el de la pantalla del sistema
            fadeDuration={0}
            accessibilityIgnoresInvertColors
          />
        </Animated.View>

        <Animated.View
          style={[estilos.textos, { opacity: aparecer, transform: [{ translateY: Animated.add(subir, deslizar) }] }]}>
          {/* Dos textos juntos: con un texto anidado Android deja un espacio entre "Canchas" y "Ya" */}
          <View accessible accessibilityLabel="CanchasYa" style={estilos.filaMarca}>
            <Text style={estilos.marca}>Canchas</Text>
            <Text style={[estilos.marca, estilos.ya]}>Ya</Text>
          </View>
          <Text style={estilos.lema}>
            Reservá y administrá canchas,{'\n'}todo en un solo lugar.
          </Text>
        </Animated.View>
      </View>

      <View style={estilos.barra}>
        <Animated.View style={[estilos.relleno, { width: anchoBarra }]} />
      </View>
    </Animated.View>
  );
}

// Fondo: degradé azul, líneas de una cancha casi transparentes y franjas verdes en las esquinas
function Fondo({ ancho, alto }: { ancho: number; alto: number }) {
  const margen = ancho * 0.08;
  const cancha = { x: margen, y: alto * 0.1, w: ancho - margen * 2, h: alto * 0.8 };
  const medio = cancha.y + cancha.h / 2;
  const area = { w: cancha.w * 0.5, h: cancha.h * 0.13 };
  return (
    <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="fondo" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0C2336" />
          <Stop offset="0.55" stopColor={AZUL_MARCA} />
          <Stop offset="1" stopColor="#030C14" />
        </LinearGradient>
        <LinearGradient id="franja" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={VERDE_MARCA} stopOpacity="0.55" />
          <Stop offset="1" stopColor="#0A8058" stopOpacity="0.15" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={ancho} height={alto} fill="url(#fondo)" />

      {/* Líneas de la cancha */}
      <Path
        d={`M${cancha.x} ${cancha.y}h${cancha.w}v${cancha.h}h${-cancha.w}Z
            M${cancha.x} ${medio}h${cancha.w}
            M${(ancho - area.w) / 2} ${cancha.y}v${area.h}h${area.w}v${-area.h}
            M${(ancho - area.w) / 2} ${cancha.y + cancha.h}v${-area.h}h${area.w}v${area.h}`}
        stroke="#FFFFFF"
        strokeOpacity={0.05}
        strokeWidth={2}
        fill="none"
      />
      <Circle cx={ancho / 2} cy={medio} r={ancho * 0.17} stroke="#FFFFFF" strokeOpacity={0.05} strokeWidth={2} fill="none" />

      {/* Franjas diagonales verdes, arriba a la izquierda y abajo a la derecha */}
      <Polygon points={`0,0 ${ancho * 0.34},0 0,${ancho * 0.34}`} fill="url(#franja)" />
      <Polygon points={`${ancho * 0.42},0 ${ancho * 0.5},0 0,${ancho * 0.5} 0,${ancho * 0.42}`} fill={VERDE_MARCA} fillOpacity={0.22} />
      <Polygon points={`${ancho},${alto} ${ancho * 0.66},${alto} ${ancho},${alto - ancho * 0.34}`} fill="url(#franja)" />
      <Polygon
        points={`${ancho * 0.58},${alto} ${ancho * 0.5},${alto} ${ancho},${alto - ancho * 0.5} ${ancho},${alto - ancho * 0.42}`}
        fill={VERDE_MARCA}
        fillOpacity={0.22}
      />
    </Svg>
  );
}

const estilos = StyleSheet.create({
  fondo: { backgroundColor: AZUL_MARCA, zIndex: 10, elevation: 10 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  simbolo: { width: ANCHO_SIMBOLO, height: ANCHO_SIMBOLO * (468 / 596) },
  // Debajo del símbolo ya subido: arranca en el centro y se corre junto con él
  textos: { position: 'absolute', top: '50%', alignItems: 'center', marginTop: 60 },
  filaMarca: { flexDirection: 'row' },
  marca: { fontSize: 42, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  // Android le deja aire al final del primer texto: se compensa para que quede como una sola palabra
  ya: { color: VERDE_MARCA, marginLeft: -4 },
  lema: { fontSize: 16, color: '#C9D6E2', textAlign: 'center', marginTop: 28, lineHeight: 23 },
  barra: {
    position: 'absolute',
    bottom: '12%',
    alignSelf: 'center',
    width: 140,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  relleno: { height: 4, borderRadius: 2, backgroundColor: VERDE_MARCA },
});
