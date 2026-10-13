import React from 'react';
import { StyleSheet, Text as TextRN, TextInput as TextInputRN, TextInputProps, TextProps } from 'react-native';
import { FUENTE } from '../theme/tema';

/**
 * Text y TextInput con la fuente de la app (Inter). Se importan de acá en lugar de
 * 'react-native': React Native no tiene una fuente por defecto para toda la app.
 * El estilo de cada pantalla va después, así puede cambiar el peso o el tamaño.
 */
export function Text({ style, ...props }: TextProps) {
  return <TextRN {...props} style={[estilos.fuente, style]} />;
}

export function TextInput({ style, ...props }: TextInputProps) {
  return <TextInputRN {...props} style={[estilos.fuente, style]} />;
}

const estilos = StyleSheet.create({
  fuente: { fontFamily: FUENTE },
});
