import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Text } from './Texto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSesion } from '../context/SesionContext';
import { navegacion } from '../navigation/referencia';
import { activarNotificaciones, Aviso, escucharNotificaciones } from '../notificaciones';
import { espaciado, radio, useTema } from '../theme/tema';

const SEGUNDOS_EN_PANTALLA = 6;

/**
 * Registra el celular para las notificaciones push cuando hay sesión, abre el turno
 * (o la caja) al tocar una, y muestra un aviso arriba si llega con la app abierta.
 * Va dentro de <SesionProvider>, encima de la navegación.
 */
export function AvisosPush() {
  const { usuario } = useSesion();
  const { colores } = useTema();
  const margen = useSafeAreaInsets();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const posicion = useRef(new Animated.Value(0)).current;
  // Una notificación tocada antes de que la app esté lista (sesión cargando)
  const pendiente = useRef<Aviso | null>(null);
  const puedeAbrir = !!usuario?.tieneComplejo;
  const puedeAbrirRef = useRef(puedeAbrir);
  puedeAbrirRef.current = puedeAbrir;

  const abrir = useCallback((destino: Aviso) => {
    if (!puedeAbrirRef.current || !navegacion.isReady()) {
      pendiente.current = destino;
      return;
    }
    pendiente.current = null;
    if (destino.turnoId !== null) {
      navegacion.navigate('Turno', { id: destino.turnoId });
    } else if (destino.pantalla === 'caja') {
      navegacion.navigate('Caja');
    }
  }, []);

  useEffect(() => {
    if (usuario) {
      activarNotificaciones();
    }
  }, [usuario?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => escucharNotificaciones(setAviso, abrir), [abrir]);

  // Cuando termina de cargar la sesión se abre la que quedó pendiente (la pila tarda un instante en montarse)
  useEffect(() => {
    if (!puedeAbrir || !pendiente.current) {
      return;
    }
    const temporizador = setTimeout(() => pendiente.current && abrir(pendiente.current), 400);
    return () => clearTimeout(temporizador);
  }, [puedeAbrir, abrir]);

  // Entra desde arriba y se va sola a los pocos segundos
  useEffect(() => {
    if (!aviso) {
      return;
    }
    posicion.setValue(0);
    Animated.spring(posicion, { toValue: 1, useNativeDriver: true }).start();
    const temporizador = setTimeout(() => {
      Animated.timing(posicion, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setAviso(null));
    }, SEGUNDOS_EN_PANTALLA * 1000);
    return () => clearTimeout(temporizador);
  }, [aviso, posicion]);

  if (!aviso || !usuario) {
    return null;
  }

  const tocar = () => {
    setAviso(null);
    abrir(aviso);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        estilos.contenedor,
        {
          top: margen.top + espaciado.s,
          opacity: posicion,
          transform: [{ translateY: posicion.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }],
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${aviso.titulo}. ${aviso.cuerpo}`}
        onPress={tocar}
        style={[
          estilos.tarjeta,
          { backgroundColor: colores.superficie, borderColor: colores.borde, borderLeftColor: colores.primario },
        ]}>
        <Text numberOfLines={1} style={[estilos.titulo, { color: colores.texto }]}>
          {aviso.titulo}
        </Text>
        <Text numberOfLines={3} style={[estilos.cuerpo, { color: colores.textoSecundario }]}>
          {aviso.cuerpo}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { position: 'absolute', left: espaciado.m, right: espaciado.m },
  tarjeta: {
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    borderRadius: radio,
    paddingVertical: espaciado.s,
    paddingHorizontal: espaciado.m,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  titulo: { fontSize: 15, fontWeight: '700' },
  cuerpo: { fontSize: 14, marginTop: 2 },
});
