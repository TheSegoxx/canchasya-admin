import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Agenda, Bloqueo, CanchaAgenda, NOMBRE_ESTADO, NOMBRE_PAGO, Turno } from '../../api/agenda';
import { Icono } from '../../components/Icono';
import { espaciado, radio, useTema } from '../../theme/tema';
import { colorDeTurno } from './GrillaAgenda';

type Props = {
  agenda: Agenda;
  onTurno: (turno: Turno) => void;
  onBloqueo: (bloqueo: Bloqueo, cancha: CanchaAgenda) => void;
  onWhatsApp: (turno: Turno) => void;
};

type Elemento = { tipo: 'turno'; turno: Turno } | { tipo: 'bloqueo'; bloqueo: Bloqueo };

const inicio = (e: Elemento) => (e.tipo === 'turno' ? e.turno.horaInicio : e.bloqueo.horaDesde);

// Los turnos del día en orden de horario, incluidos los cancelados (para poder avisarles)
export function ListaAgenda({ agenda, onTurno, onBloqueo, onWhatsApp }: Props) {
  const { colores } = useTema();
  const canchas = new Map(agenda.canchas.map(c => [c.id, c]));
  const elementos: Elemento[] = [
    ...agenda.turnos.map(turno => ({ tipo: 'turno' as const, turno })),
    ...agenda.bloqueos.map(bloqueo => ({ tipo: 'bloqueo' as const, bloqueo })),
  ].sort((a, b) => inicio(a).localeCompare(inicio(b)));

  const fila = ({ item }: { item: Elemento }) => {
    if (item.tipo === 'bloqueo') {
      const b = item.bloqueo;
      const cancha = canchas.get(b.canchaId);
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => cancha && onBloqueo(b, cancha)}
          style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.borde, borderLeftColor: colores.inactivo }]}>
          <Horario desde={b.horaDesde} hasta={b.horaHasta} />
          <View style={estilos.datos}>
            <View style={estilos.filaTitulo}>
              <Icono nombre="candado" color={colores.textoSecundario} tamano={16} />
              <Text style={[estilos.titulo, estilos.conIcono, { color: colores.texto }]}>Bloqueada: {b.motivo}</Text>
            </View>
            <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>{cancha?.nombre}</Text>
          </View>
        </Pressable>
      );
    }

    const t = item.turno;
    const cancelado = t.estado === 'cancelado';
    const color = colorDeTurno(t, colores);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Abre el turno"
        onPress={() => onTurno(t)}
        style={({ pressed }) => [
          estilos.tarjeta,
          {
            backgroundColor: colores.superficie,
            borderColor: colores.borde,
            borderLeftColor: color,
            opacity: pressed ? 0.85 : cancelado || t.estado === 'jugado' ? 0.65 : 1,
          },
        ]}>
        <Horario desde={t.horaInicio} hasta={t.horaFin} />
        <View style={estilos.datos}>
          <View style={estilos.filaTitulo}>
            <Text
              numberOfLines={1}
              style={[estilos.titulo, { color: colores.texto }, cancelado && estilos.tachado]}>
              {t.cliente.nombre}
            </Text>
            {t.turnoFijoId !== null && (
              <View style={estilos.conIcono}>
                <Icono nombre="repetir" color={colores.textoSecundario} tamano={14} />
              </View>
            )}
          </View>
          <Text style={[estilos.detalle, { color: colores.textoSecundario }]} numberOfLines={1}>
            {canchas.get(t.canchaId)?.nombre} ·{' '}
            {cancelado || t.estado === 'jugado' ? (
              NOMBRE_ESTADO[t.estado]
            ) : (
              <Text style={{ color }}>{NOMBRE_PAGO[t.estadoPago]}</Text>
            )}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Escribirle por WhatsApp a ${t.cliente.nombre}`}
          onPress={() => onWhatsApp(t)}
          hitSlop={6}
          style={({ pressed }) => [estilos.whatsapp, { opacity: pressed ? 0.6 : 1 }]}>
          <Icono nombre="whatsapp" color={colores.whatsapp} tamano={26} />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <FlatList
      data={elementos}
      keyExtractor={e => (e.tipo === 'turno' ? `t${e.turno.id}` : `b${e.bloqueo.id}`)}
      renderItem={fila}
      contentContainerStyle={estilos.lista}
      ListEmptyComponent={
        <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>
          No hay turnos este día. Tocá + para cargar uno.
        </Text>
      }
    />
  );
}

function Horario({ desde, hasta }: { desde: string; hasta: string }) {
  const { colores } = useTema();
  return (
    <View style={estilos.horario}>
      <Text style={[estilos.hora, { color: colores.texto }]}>{desde}</Text>
      <Text style={[estilos.horaFin, { color: colores.textoSecundario }]}>{hasta}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espaciado.m, paddingBottom: 96 },
  vacio: { fontSize: 15, textAlign: 'center', paddingTop: espaciado.xl },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingLeft: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    borderLeftWidth: 5,
    marginBottom: espaciado.s,
  },
  horario: { width: 52 },
  hora: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  horaFin: { fontSize: 13, fontVariant: ['tabular-nums'] },
  datos: { flex: 1, marginLeft: espaciado.s, paddingVertical: espaciado.s },
  filaTitulo: { flexDirection: 'row', alignItems: 'center' },
  titulo: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  conIcono: { marginLeft: espaciado.xs },
  tachado: { textDecorationLine: 'line-through' },
  detalle: { fontSize: 14, marginTop: 2 },
  whatsapp: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
