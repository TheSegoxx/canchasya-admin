import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { espaciado, useTema } from '../theme/tema';
import { Boton } from './Boton';

type Props = {
  mensaje: string;
  onReintentar: () => void;
  // Acción extra opcional debajo de "Reintentar" (por ejemplo, cerrar sesión)
  accion?: { titulo: string; onPress: () => void };
};

// Pantalla completa para cuando no se pudieron traer los datos:
// así nunca se muestra un formulario vacío que pisaría lo guardado
export function ErrorCarga({ mensaje, onReintentar, accion }: Props) {
  const { colores } = useTema();
  return (
    <View style={[estilos.contenedor, { backgroundColor: colores.fondo }]}>
      <Text accessibilityLiveRegion="polite" style={[estilos.mensaje, { color: colores.texto }]}>
        {mensaje}
      </Text>
      <Boton titulo="Reintentar" onPress={onReintentar} />
      {accion && (
        <>
          <View style={estilos.espacio} />
          <Boton titulo={accion.titulo} variante="texto" onPress={accion.onPress} />
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: 'center', padding: espaciado.l },
  mensaje: { fontSize: 16, lineHeight: 22, textAlign: 'center', marginBottom: espaciado.l },
  espacio: { height: espaciado.s },
});
