import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from './Texto';
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
          // Seleccionado: fondo verde suave y borde verde (sin bloques de color fuerte)
          backgroundColor: seleccionado ? colores.primario + '1F' : colores.superficie,
          borderColor: seleccionado ? colores.primario : colores.borde,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <Text
        style={[
          estilos.texto,
          { color: seleccionado ? colores.primario : colores.texto, fontWeight: seleccionado ? '600' : '500' },
        ]}>
        {texto}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  chip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    marginRight: espaciado.s,
    marginBottom: espaciado.s,
  },
  texto: { fontSize: 14 },
});
