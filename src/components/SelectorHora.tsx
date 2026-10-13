import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { espaciado, radio, useTema } from '../theme/tema';
import { aHora, aMinutos } from '../utils/horas';

type Props = {
  etiqueta: string;
  valor: string; // "HH:MM"
  onCambiar: (valor: string) => void;
  minimo?: string;
  maximo?: string;
  paso?: number; // minutos
};

// Elige una hora con botones − / + (sin librerías nativas extra)
export function SelectorHora({ etiqueta, valor, onCambiar, minimo = '00:00', maximo = '24:00', paso = 30 }: Props) {
  const { colores } = useTema();
  const actual = aMinutos(valor);
  const puedeBajar = actual - paso >= aMinutos(minimo);
  const puedeSubir = actual + paso <= aMinutos(maximo);

  const boton = (texto: string, habilitado: boolean, delta: number, descripcion: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${etiqueta}: ${descripcion}`}
      accessibilityState={{ disabled: !habilitado }}
      disabled={!habilitado}
      onPress={() => onCambiar(aHora(actual + delta))}
      hitSlop={6}
      style={({ pressed }) => [
        estilos.boton,
        { borderColor: colores.borde, opacity: !habilitado ? 0.35 : pressed ? 0.6 : 1 },
      ]}>
      <Text style={[estilos.signo, { color: colores.primario }]}>{texto}</Text>
    </Pressable>
  );

  return (
    <View style={estilos.contenedor}>
      <Text style={[estilos.etiqueta, { color: colores.textoSecundario }]}>{etiqueta}</Text>
      <View style={[estilos.fila, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        {boton('−', puedeBajar, -paso, `${paso} minutos antes`)}
        <Text accessibilityLiveRegion="polite" style={[estilos.hora, { color: colores.texto }]}>
          {valor === '24:00' ? '24:00 (medianoche)' : valor}
        </Text>
        {boton('+', puedeSubir, paso, `${paso} minutos después`)}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  etiqueta: { fontSize: 14, fontWeight: '600', marginBottom: espaciado.xs },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radio,
    padding: espaciado.xs,
  },
  boton: { width: 44, height: 44, borderRadius: radio - 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  signo: { fontSize: 24, fontWeight: '600' },
  hora: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
});
