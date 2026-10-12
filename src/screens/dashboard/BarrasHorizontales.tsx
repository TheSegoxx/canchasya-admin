import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { espaciado, useTema } from '../../theme/tema';
import { formatearPesos } from '../../utils/formato';

type Props = {
  items: { clave: string | number; nombre: string; monto: number }[];
  // Un solo color para toda la serie: el largo de la barra ya muestra el monto
  color: string;
};

// Ranking de montos (gastos por categoría, cobrado por cancha): barra + valor en la punta
export function BarrasHorizontales({ items, color }: Props) {
  const { colores } = useTema();
  const maximo = Math.max(...items.map(i => i.monto), 1);
  return (
    <View>
      {items.map(item => (
        <View key={item.clave} style={estilos.fila} accessible accessibilityLabel={`${item.nombre}: ${formatearPesos(item.monto)}`}>
          <Text numberOfLines={2} style={[estilos.nombre, { color: colores.texto }]}>
            {item.nombre}
          </Text>
          <View style={estilos.pista}>
            <View style={[estilos.barra, { width: `${(item.monto / maximo) * 100}%`, backgroundColor: color }]} />
          </View>
          <Text style={[estilos.monto, { color: colores.texto }]}>{formatearPesos(item.monto)}</Text>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  nombre: { width: 110, fontSize: 14 },
  pista: { flex: 1, marginHorizontal: espaciado.s },
  // Punta redondeada, base recta
  barra: { height: 12, minWidth: 2, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  monto: { minWidth: 76, fontSize: 14, fontWeight: '600', textAlign: 'right', fontVariant: ['tabular-nums'] },
});
