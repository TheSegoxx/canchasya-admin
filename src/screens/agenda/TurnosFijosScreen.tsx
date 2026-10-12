import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { agendaApi, TurnoFijo } from '../../api/agenda';
import { Boton } from '../../components/Boton';
import { Icono } from '../../components/Icono';
import { mensajeDeError } from '../../context/SesionContext';
import { espaciado, radio, useTema } from '../../theme/tema';
import { diaEnPlural, diaSemana, fechaCorta, hoyISO, sumarDias } from '../../utils/fechas';
import { formatearPesos } from '../../utils/formato';
import { aMinutos, minutosAhora } from '../../utils/horas';
import { formatearTelefono } from '../../utils/telefono';

// Todos los turnos fijos vigentes, ordenados por día de la semana
export function TurnosFijosScreen() {
  const { colores } = useTema();
  const [fijos, setFijos] = useState<TurnoFijo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setFijos((await agendaApi.listarFijos()).turnosFijos);
      setError('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  // Desde hoy; si hoy le toca y ya empezó, desde la semana que viene (el de hoy ya se jugó)
  const darDeBaja = (fijo: TurnoFijo) => {
    const hoy = hoyISO();
    const yaEmpezoHoy = diaSemana(hoy) === fijo.diaSemana && minutosAhora() >= aMinutos(fijo.horaInicio);
    const desde = yaEmpezoHoy ? sumarDias(hoy, 1) : hoy;
    Alert.alert(
      'Dar de baja el turno fijo',
      `${fijo.cliente.nombre} deja de tener la ${fijo.canchaNombre} los ${diaEnPlural(fijo.diaSemana)} a las ${fijo.horaInicio}. Los turnos que ya estaban reservados se cancelan.`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Dar de baja',
          style: 'destructive',
          onPress: async () => {
            try {
              const { aviso } = await agendaApi.darDeBajaFijo(fijo.id, desde);
              if (aviso) {
                Alert.alert('Turno fijo dado de baja', aviso);
              }
              cargar();
            } catch (e) {
              Alert.alert('No se pudo dar de baja', mensajeDeError(e));
            }
          },
        },
      ],
    );
  };

  const tarjeta = ({ item }: { item: TurnoFijo }) => {
    const dia = diaEnPlural(item.diaSemana);
    return (
      <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        <View style={estilos.datos}>
          <Text style={[estilos.dia, { color: colores.primario }]}>
            {dia.charAt(0).toUpperCase() + dia.slice(1)} · {item.horaInicio} a {item.horaFin}
          </Text>
          <Text style={[estilos.nombre, { color: colores.texto }]}>{item.cliente.nombre}</Text>
          <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
            {item.canchaNombre} · {formatearTelefono(item.cliente.telefono)}
          </Text>
          <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
            {item.precio !== null ? `Precio especial: ${formatearPesos(item.precio)}` : 'Precio de la cancha'}
            {item.fechaHasta ? ` · último: ${fechaCorta(item.fechaHasta)}` : ''}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Dar de baja el turno fijo de ${item.cliente.nombre}`}
          onPress={() => darDeBaja(item)}
          hitSlop={8}
          style={estilos.borrar}>
          <Icono nombre="borrar" color={colores.error} tamano={22} />
        </Pressable>
      </View>
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: colores.fondo }}
      data={fijos}
      keyExtractor={f => String(f.id)}
      renderItem={tarjeta}
      contentContainerStyle={estilos.lista}
      refreshControl={
        <RefreshControl
          refreshing={cargando}
          onRefresh={() => {
            setCargando(true);
            cargar();
          }}
          colors={[colores.primario]}
        />
      }
      ListHeaderComponent={
        error && fijos.length > 0 ? <Text style={[estilos.aviso, { color: colores.error }]}>{error}</Text> : undefined
      }
      ListEmptyComponent={
        cargando ? undefined : error ? (
          <View>
            <Text style={[estilos.vacio, { color: colores.error }]}>{error}</Text>
            <Boton titulo="Reintentar" variante="secundario" onPress={cargar} />
          </View>
        ) : (
          <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>
            No hay turnos fijos. Al reservar un turno, activá "Turno fijo" para que se repita todas las semanas.
          </Text>
        )
      }
    />
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espaciado.m },
  aviso: { fontSize: 14, marginBottom: espaciado.s },
  vacio: { fontSize: 15, textAlign: 'center', paddingVertical: espaciado.xl, lineHeight: 21 },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: espaciado.m,
    paddingVertical: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    marginBottom: espaciado.s,
  },
  datos: { flex: 1 },
  dia: { fontSize: 14, fontWeight: '700' },
  nombre: { fontSize: 17, fontWeight: '700', marginTop: 2 },
  detalle: { fontSize: 14, marginTop: 2 },
  borrar: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
});
