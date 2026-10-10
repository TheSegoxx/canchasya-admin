import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { espaciado, useTema } from '../theme/tema';

type Props = { texto: string; seleccionado: boolean; onPress: () => void };

// Opción que se marca o desmarca con un toque
export function Chip({ texto, seleccionado, onPress }: Props) {
  const { colores } = useTema();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: seleccionado }}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.chip,
        {
          backgroundColor: seleccionado ? colores.primario : colores.superficie,
          borderColor: seleccionado ? colores.primario : colores.borde,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <Text style={[estilos.texto, { color: seleccionado ? colores.textoSobrePrimario : colores.texto }]}>
        {seleccionado ? `✓ ${texto}` : texto}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: espaciado.m,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    marginRight: espaciado.s,
    marginBottom: espaciado.s,
  },
  texto: { fontSize: 15, fontWeight: '500' },
});
