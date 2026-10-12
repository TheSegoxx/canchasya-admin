import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { espaciado, radio, useTema } from '../theme/tema';
import { Icono, NombreIcono } from './Icono';

type Props = {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'texto';
  cargando?: boolean;
  deshabilitado?: boolean;
  icono?: NombreIcono;
  // Color propio (por ejemplo, el verde de WhatsApp) en lugar del primario
  color?: string;
};

// Botón grande (mínimo 48 dp de alto) para usar con una sola mano
export function Boton({ titulo, onPress, variante = 'primario', cargando, deshabilitado, icono, color }: Props) {
  const { colores } = useTema();
  const inactivo = deshabilitado || cargando;
  const principal = color ?? colores.primario;

  const fondo = variante === 'primario' ? principal : 'transparent';
  const colorTexto = variante === 'primario' ? colores.textoSobrePrimario : principal;
  const borde = variante === 'secundario' ? principal : 'transparent';

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
        <View style={estilos.contenido}>
          {icono && <Icono nombre={icono} color={colorTexto} tamano={20} />}
          <Text style={[estilos.texto, { color: colorTexto }, icono && estilos.conIcono]}>{titulo}</Text>
        </View>
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
  contenido: { flexDirection: 'row', alignItems: 'center' },
  texto: { fontSize: 16, fontWeight: '600' },
  conIcono: { marginLeft: espaciado.s },
});
