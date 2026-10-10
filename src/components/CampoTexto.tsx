import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { espaciado, radio, useTema } from '../theme/tema';

type Props = TextInputProps & { etiqueta: string };

// Campo de formulario con su etiqueta arriba
export function CampoTexto({ etiqueta, style, ...props }: Props) {
  const { colores } = useTema();
  return (
    <View style={estilos.contenedor}>
      <Text style={[estilos.etiqueta, { color: colores.textoSecundario }]}>{etiqueta}</Text>
      <TextInput
        placeholderTextColor={colores.inactivo}
        style={[
          estilos.campo,
          { color: colores.texto, backgroundColor: colores.superficie, borderColor: colores.borde },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { marginBottom: espaciado.m },
  etiqueta: { fontSize: 14, fontWeight: '600', marginBottom: espaciado.xs },
  campo: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radio,
    paddingHorizontal: espaciado.m,
    fontSize: 16,
  },
});
