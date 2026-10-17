import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import type { Usuario } from '../api/auth';
import { espaciado, radio, useTema } from '../theme/tema';

type Props = { usuario: Usuario; detalle?: string | null };

// Foto (o inicial), nombre, email y una línea más (por ejemplo, "Dueño de Complejo Norte")
export function TarjetaCuenta({ usuario, detalle }: Props) {
  const { colores } = useTema();
  return (
    <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      {usuario.foto ? (
        <Image source={{ uri: usuario.foto }} style={estilos.foto} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[estilos.foto, estilos.inicial, { backgroundColor: colores.primario + '1F' }]}>
          <Text style={[estilos.letra, { color: colores.primario }]}>{usuario.nombre.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={estilos.datos}>
        <Text style={[estilos.nombre, { color: colores.texto }]}>{usuario.nombre}</Text>
        <Text style={[estilos.email, { color: colores.textoSecundario }]}>{usuario.email}</Text>
        {!!detalle && <Text style={[estilos.email, { color: colores.textoSecundario }]}>{detalle}</Text>}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espaciado.m,
    borderRadius: radio,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: espaciado.l,
  },
  foto: { width: 52, height: 52, borderRadius: 26 },
  inicial: { alignItems: 'center', justifyContent: 'center' },
  letra: { fontSize: 22, fontWeight: '600' },
  datos: { flex: 1, marginLeft: espaciado.m },
  nombre: { fontSize: 17, fontWeight: '600' },
  email: { fontSize: 13, marginTop: 2 },
});
