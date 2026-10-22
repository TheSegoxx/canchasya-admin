import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';

type Props = {
  // Modo del celular al abrir la app: el mismo que usó la pantalla de carga del sistema
  oscuro: boolean;
  // La sesión y el tema ya cargaron: cuando termina la animación, se va
  listo: boolean;
  alTerminar: () => void;
};

// Tiempo mínimo en pantalla, para que la animación se vea completa aunque todo cargue al instante
const DURACION_MINIMA_MS = 1600;

// Diseños de assets/app/CanchasYa_Splash_*.png, sin el borde y sin la barra (la dibuja la app, animada)
const IMAGEN = {
  oscuro: require('../../assets/app/splash-oscuro.png'),
  claro: require('../../assets/app/splash-claro.png'),
};
const ANCHO_IMAGEN = 657;
const ALTO_IMAGEN = 1153;
// Dónde estaba la barra en el diseño, en píxeles de la imagen
const BARRA = { x: 236, y: 713, ancho: 184, alto: 12 };

const COLORES = {
  oscuro: { fondo: '#01101A', pista: '#007756', relleno: '#00F892' },
  claro: { fondo: '#F5FBFE', pista: '#93E8CD', relleno: '#00D77D' },
};

/**
 * Pantalla de carga con el diseño de assets/app (claro u oscuro, según el celular).
 * La imagen cubre toda la pantalla y la barra de progreso se ubica justo donde estaba en el diseño.
 */
export function PantallaDeCarga({ oscuro, listo, alTerminar }: Props) {
  const { width, height } = useWindowDimensions();
  const entrada = useRef(new Animated.Value(0)).current;
  const progreso = useRef(new Animated.Value(0)).current;
  const salida = useRef(new Animated.Value(1)).current;
  const [minimoCumplido, setMinimoCumplido] = useState(false);

  useEffect(() => {
    // Viene de la pantalla del sistema (solo el logo): el diseño completo aparece con un fundido
    Animated.timing(entrada, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.quad),
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

  const modo = oscuro ? 'oscuro' : 'claro';
  const colores = COLORES[modo];
  // Igual que resizeMode="cover": la imagen llena la pantalla y lo que sobra se recorta parejo de los dos lados
  const escala = Math.max(width / ANCHO_IMAGEN, height / ALTO_IMAGEN);
  const margenX = (width - ANCHO_IMAGEN * escala) / 2;
  const margenY = (height - ALTO_IMAGEN * escala) / 2;
  const barra = {
    left: margenX + BARRA.x * escala,
    top: margenY + BARRA.y * escala,
    width: BARRA.ancho * escala,
    height: BARRA.alto * escala,
    borderRadius: (BARRA.alto * escala) / 2,
  };
  const anchoRelleno = progreso.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Cargando CanchasYa"
      style={[StyleSheet.absoluteFill, estilos.capa, { backgroundColor: colores.fondo, opacity: salida }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: entrada }]}>
        <Image
          source={IMAGEN[modo]}
          style={[estilos.imagen, { left: margenX, top: margenY, width: ANCHO_IMAGEN * escala, height: ALTO_IMAGEN * escala }]}
          fadeDuration={0}
          accessibilityIgnoresInvertColors
        />
        <View style={[estilos.barra, barra, { backgroundColor: colores.pista }]}>
          <Animated.View style={[estilos.relleno, { width: anchoRelleno, borderRadius: barra.borderRadius, backgroundColor: colores.relleno }]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  capa: { zIndex: 10, elevation: 10 },
  imagen: { position: 'absolute' },
  barra: { position: 'absolute', overflow: 'hidden' },
  relleno: { height: '100%' },
});
