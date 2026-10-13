import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Text } from './Texto';
import { espaciado, radio, useTema } from '../theme/tema';

type Props = {
  titulo: string;
  descripcion?: string;
  valor: boolean;
  onCambiar: (valor: boolean) => void;
  deshabilitado?: boolean;
};

// Fila con texto a la izquierda y un interruptor a la derecha
export function FilaInterruptor({ titulo, descripcion, valor, onCambiar, deshabilitado }: Props) {
  const { colores } = useTema();
  return (
    <View style={[estilos.fila, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      <View style={estilos.textos}>
        <Text style={[estilos.titulo, { color: colores.texto }]}>{titulo}</Text>
        {!!descripcion && (
          <Text style={[estilos.descripcion, { color: colores.textoSecundario }]}>{descripcion}</Text>
        )}
      </View>
      <Switch
        accessibilityLabel={titulo}
        value={valor}
        onValueChange={onCambiar}
        disabled={deshabilitado}
        trackColor={{ true: colores.primario, false: colores.borde }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: espaciado.m,
    paddingVertical: espaciado.s,
    borderWidth: 1,
    borderRadius: radio,
    marginBottom: espaciado.m,
  },
  textos: { flex: 1, marginRight: espaciado.m },
  titulo: { fontSize: 16, fontWeight: '600' },
  descripcion: { fontSize: 13, marginTop: 2 },
});
