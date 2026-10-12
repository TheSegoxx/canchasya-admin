import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { espaciado, radio, useTema } from '../theme/tema';
import { DIAS_CORTOS, inicioDeSemana, sumarDias } from '../utils/fechas';
import { Icono } from './Icono';

const SIN_COLOR = 'transparent';

type Props = {
  fecha: string; // "AAAA-MM-DD" elegida
  hoy: string;
  onCambiar: (fecha: string) => void;
};

// Tira con los 7 días de la semana; las flechas pasan a la semana anterior o siguiente
export function SelectorSemana({ fecha, hoy, onCambiar }: Props) {
  const { colores } = useTema();
  const lunes = inicioDeSemana(fecha);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));

  const flecha = (direccion: 'anterior' | 'siguiente') => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direccion === 'anterior' ? 'Semana anterior' : 'Semana siguiente'}
      onPress={() => onCambiar(sumarDias(fecha, direccion === 'anterior' ? -7 : 7))}
      hitSlop={8}
      style={({ pressed }) => [estilos.flecha, { opacity: pressed ? 0.5 : 1 }]}>
      <Icono nombre={direccion} color={colores.primario} />
    </Pressable>
  );

  return (
    <View style={[estilos.fila, { backgroundColor: colores.superficie, borderBottomColor: colores.borde }]}>
      {flecha('anterior')}
      {dias.map((dia, i) => {
        const elegido = dia === fecha;
        const esHoy = dia === hoy;
        const colorTexto = elegido ? colores.textoSobrePrimario : colores.texto;
        const fondo = elegido ? colores.primario : SIN_COLOR;
        // Hoy se marca con un borde cuando no es el día elegido
        const borde = esHoy && !elegido ? colores.primario : SIN_COLOR;
        return (
          <Pressable
            key={dia}
            accessibilityRole="button"
            accessibilityState={{ selected: elegido }}
            accessibilityLabel={`${DIAS_CORTOS[i]} ${Number(dia.slice(8))}${esHoy ? ', hoy' : ''}`}
            onPress={() => onCambiar(dia)}
            style={[estilos.dia, { backgroundColor: fondo, borderColor: borde }]}>
            <Text style={[estilos.nombre, { color: elegido ? colorTexto : colores.textoSecundario }]}>
              {DIAS_CORTOS[i]}
            </Text>
            <Text style={[estilos.numero, { color: colorTexto }]}>{Number(dia.slice(8))}</Text>
          </Pressable>
        );
      })}
      {flecha('siguiente')}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: espaciado.s,
    paddingHorizontal: espaciado.xs,
    borderBottomWidth: 1,
  },
  flecha: { width: 32, height: 48, alignItems: 'center', justifyContent: 'center' },
  dia: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginHorizontal: 2,
    borderRadius: radio - 2,
    borderWidth: 1.5,
  },
  nombre: { fontSize: 12, fontWeight: '600' },
  numero: { fontSize: 17, fontWeight: '700', marginTop: 2 },
});
