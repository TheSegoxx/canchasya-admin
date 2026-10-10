import React from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { espaciado, useTema } from '../theme/tema';

type Props = {
  children: React.ReactNode;
  // Las pantallas con barra de navegación arriba ya tienen el margen superior resuelto
  conMargenSuperior?: boolean;
  centrado?: boolean;
};

// Contenedor base: fondo del tema, scroll y lugar para el teclado
export function Pantalla({ children, conMargenSuperior = false, centrado = false }: Props) {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={[estilos.flex, { backgroundColor: colores.fondo }]} behavior="height">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          estilos.contenido,
          centrado && estilos.centrado,
          {
            paddingTop: (conMargenSuperior ? insets.top : 0) + espaciado.l,
            paddingBottom: insets.bottom + espaciado.l,
          },
        ]}>
        <View>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  contenido: { flexGrow: 1, paddingHorizontal: espaciado.m },
  centrado: { justifyContent: 'center' },
});
