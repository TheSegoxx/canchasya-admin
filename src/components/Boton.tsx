import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
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

/**
 * Botón minimalista (mínimo 48 dp de alto, para usar con una sola mano):
 * - primario: relleno, para la acción principal de la pantalla;
 * - secundario: solo un borde fino;
 * - texto: sin fondo ni borde, para acciones menores.
 */
export function Boton({ titulo, onPress, variante = 'primario', cargando, deshabilitado, icono, color }: Props) {
  const { colores } = useTema();
  const inactivo = deshabilitado || cargando;

  const fondo = variante === 'primario' ? color ?? colores.primario : 'transparent';
  const colorTexto =
    variante === 'primario'
      ? colores.textoSobrePrimario
      : variante === 'secundario'
        ? color ?? colores.texto
        : color ?? colores.primario;
  const borde = variante === 'secundario' ? color ?? colores.borde : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactivo, busy: !!cargando }}
      disabled={inactivo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.boton,
        variante === 'texto' && estilos.botonTexto,
        {
          backgroundColor: pressed && variante !== 'primario' ? colores.borde + '80' : fondo,
          borderColor: borde,
          opacity: inactivo ? 0.5 : pressed && variante === 'primario' ? 0.88 : 1,
        },
      ]}>
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <View style={estilos.contenido}>
          {icono && <Icono nombre={icono} color={colorTexto} acento={colorTexto} tamano={18} />}
          <Text style={[estilos.texto, { color: colorTexto }, icono && estilos.conIcono]}>{titulo}</Text>
        </View>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    minHeight: 48,
    borderRadius: radio,
    borderWidth: 1,
    paddingHorizontal: espaciado.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: { minHeight: 44, paddingHorizontal: espaciado.s },
  contenido: { flexDirection: 'row', alignItems: 'center' },
  texto: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  conIcono: { marginLeft: espaciado.s },
});
