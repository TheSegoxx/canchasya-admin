import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { espaciado, radio, useTema } from '../theme/tema';
import { Icono, NombreIcono } from './Icono';

type Props = { icono: NombreIcono; titulo: string; texto: string };

// Tarjeta para una parte de la app que todavía se está construyendo
export function Proximamente({ icono, titulo, texto }: Props) {
  const { colores } = useTema();
  return (
    <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      <View style={[estilos.circulo, { backgroundColor: colores.primario + '1F' }]}>
        <Icono nombre={icono} color={colores.primario} acento={colores.acento} tamano={32} />
      </View>
      <Text style={[estilos.titulo, { color: colores.texto }]}>{titulo}</Text>
      <Text style={[estilos.texto, { color: colores.textoSecundario }]}>{texto}</Text>
      <View style={[estilos.pastilla, { borderColor: colores.primario }]}>
        <Text style={[estilos.pronto, { color: colores.primario }]}>Muy pronto</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    alignItems: 'center',
    padding: espaciado.l,
    borderRadius: radio,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: espaciado.l,
  },
  circulo: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: espaciado.m },
  titulo: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: espaciado.xs },
  texto: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: espaciado.m },
  pastilla: { borderWidth: 1, borderRadius: 999, paddingHorizontal: espaciado.m, paddingVertical: 4 },
  pronto: { fontSize: 13, fontWeight: '600' },
});
