import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { espaciado, radio, useTema } from '../theme/tema';

type Props = {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'texto';
  cargando?: boolean;
  deshabilitado?: boolean;
};

// Botón grande (mínimo 48 dp de alto) para usar con una sola mano
export function Boton({ titulo, onPress, variante = 'primario', cargando, deshabilitado }: Props) {
  const { colores } = useTema();
  const inactivo = deshabilitado || cargando;

  const fondo = variante === 'primario' ? colores.primario : 'transparent';
  const colorTexto = variante === 'primario' ? colores.textoSobrePrimario : colores.primario;
  const borde = variante === 'secundario' ? colores.primario : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactivo, busy: !!cargando }}
      disabled={inactivo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: fondo, borderColor: borde, opacity: inactivo ? 0.6 : pressed ? 0.85 : 1 },
      ]}>
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <Text style={[estilos.texto, { color: colorTexto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    minHeight: 50,
    borderRadius: radio,
    borderWidth: 1.5,
    paddingHorizontal: espaciado.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { fontSize: 16, fontWeight: '600' },
});
