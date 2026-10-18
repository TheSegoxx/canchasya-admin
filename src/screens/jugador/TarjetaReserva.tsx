import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { Reserva } from '../../api/reservas';
import { Icono } from '../../components/Icono';
import { Colores, espaciado, radio, useTema } from '../../theme/tema';
import { deISO, DIAS_CORTOS, diaSemana, MESES_CORTOS } from '../../utils/fechas';
import { estadoReserva, Tono } from '../../utils/reservas';

export const colorDeTono = (tono: Tono, colores: Colores) =>
  ({ aviso: colores.senado, bien: colores.primario, neutro: colores.textoSecundario, mal: colores.error })[tono];

// Una reserva en la lista: el día a la izquierda, dónde y a qué hora, y cómo está
export function TarjetaReserva({ reserva, onPress }: { reserva: Reserva; onPress: () => void }) {
  const { colores } = useTema();
  const estado = estadoReserva(reserva);
  const color = colorDeTono(estado.tono, colores);
  const fecha = deISO(reserva.fecha);
  const apagada = reserva.estado === 'cancelado' || reserva.terminada;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Abre la reserva"
      onPress={onPress}
      style={({ pressed }) => [
        estilos.tarjeta,
        { backgroundColor: colores.superficie, borderColor: colores.borde, opacity: pressed ? 0.85 : apagada ? 0.7 : 1 },
      ]}>
      <View style={[estilos.dia, { backgroundColor: colores.primario + '14' }]}>
        <Text style={[estilos.diaSemana, { color: colores.primario }]}>{DIAS_CORTOS[diaSemana(reserva.fecha) - 1]}</Text>
        <Text style={[estilos.numero, { color: colores.texto }]}>{fecha.getDate()}</Text>
        <Text style={[estilos.mes, { color: colores.textoSecundario }]}>{MESES_CORTOS[fecha.getMonth()]}</Text>
      </View>
      <View style={estilos.datos}>
        <Text style={[estilos.complejo, { color: colores.texto }]} numberOfLines={1}>
          {reserva.complejo.nombre}
        </Text>
        <View style={estilos.fila}>
          <Icono nombre={reserva.cancha.deporte} color={colores.textoSecundario} tamano={15} />
          <Text style={[estilos.detalle, { color: colores.textoSecundario }]} numberOfLines={1}>
            {reserva.cancha.nombre} · {reserva.horaInicio} a {reserva.horaFin === '24:00' ? '00:00' : reserva.horaFin}
          </Text>
        </View>
        <Text style={[estilos.estado, { color }]} numberOfLines={1}>
          {estado.texto}
        </Text>
      </View>
      <Icono nombre="siguiente" color={colores.inactivo} tamano={18} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radio,
    padding: espaciado.s,
    paddingRight: espaciado.m,
    marginBottom: espaciado.s,
  },
  dia: { width: 58, borderRadius: radio - 4, alignItems: 'center', paddingVertical: espaciado.s },
  diaSemana: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  numero: { fontSize: 22, fontWeight: '700', lineHeight: 26 },
  mes: { fontSize: 12 },
  datos: { flex: 1, marginHorizontal: espaciado.m },
  complejo: { fontSize: 16, fontWeight: '700' },
  fila: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  detalle: { fontSize: 14, marginLeft: 6, flexShrink: 1 },
  estado: { fontSize: 13, fontWeight: '600', marginTop: 4 },
});
