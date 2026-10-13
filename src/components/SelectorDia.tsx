import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { espaciado, radio, useTema } from '../theme/tema';
import { fechaRelativa, sumarDias } from '../utils/fechas';
import { Icono } from './Icono';

type Props = {
  etiqueta: string;
  fecha: string; // "AAAA-MM-DD"
  onCambiar: (fecha: string) => void;
  minimo?: string;
};

// Elige un día con flechas ‹ › (sin calendario nativo)
export function SelectorDia({ etiqueta, fecha, onCambiar, minimo }: Props) {
  const { colores } = useTema();
  const puedeBajar = minimo === undefined || fecha > minimo;

  const flecha = (direccion: 'anterior' | 'siguiente', habilitada: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direccion === 'anterior' ? 'Día anterior' : 'Día siguiente'}
      accessibilityState={{ disabled: !habilitada }}
      disabled={!habilitada}
      onPress={() => onCambiar(sumarDias(fecha, direccion === 'anterior' ? -1 : 1))}
      hitSlop={6}
      style={({ pressed }) => [
        estilos.boton,
        { borderColor: colores.borde, opacity: !habilitada ? 0.35 : pressed ? 0.6 : 1 },
      ]}>
      <Icono nombre={direccion} color={colores.primario} />
    </Pressable>
  );

  return (
    <View style={estilos.contenedor}>
      <Text style={[estilos.etiqueta, { color: colores.textoSecundario }]}>{etiqueta}</Text>
      <View style={[estilos.fila, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        {flecha('anterior', puedeBajar)}
        <Text accessibilityLiveRegion="polite" style={[estilos.fecha, { color: colores.texto }]}>
          {fechaRelativa(fecha)}
        </Text>
        {flecha('siguiente', true)}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { marginBottom: espaciado.m },
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
  fecha: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
});
