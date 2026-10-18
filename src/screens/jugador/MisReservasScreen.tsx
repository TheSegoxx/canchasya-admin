import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Reserva, reservasApi } from '../../api/reservas';
import { Boton } from '../../components/Boton';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Proximamente } from '../../components/Proximamente';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasJugador, RutasPestanasJugador } from '../../navigation/AppNavigator';
import { espaciado, useTema } from '../../theme/tema';
import { TarjetaReserva } from './TarjetaReserva';

// Pestaña "Mis reservas" del jugador: las próximas primero y después las anteriores
export function MisReservasScreen() {
  const { colores } = useTema();
  const navigation =
    useNavigation<
      CompositeNavigationProp<BottomTabNavigationProp<RutasPestanasJugador, 'MisReservas'>, NativeStackNavigationProp<RutasJugador>>
    >();
  const [reservas, setReservas] = useState<{ proximas: Reserva[]; anteriores: Reserva[] } | null>(null);
  const [error, setError] = useState('');
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setReservas(await reservasApi.listar());
      setError('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setRecargando(false);
    }
  }, []);

  // Al volver de una reserva (pudo pagarla o cancelarla)
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (!reservas) {
    return error ? (
      <ErrorCarga mensaje={error} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  if (reservas.proximas.length === 0 && reservas.anteriores.length === 0) {
    return (
      <View style={[estilos.vacio, { backgroundColor: colores.fondo }]}>
        <Proximamente
          icono="agenda"
          titulo="Todavía no reservaste"
          texto="Buscá un complejo, elegí la cancha y el horario, y reservá en un minuto."
        />
        <Boton titulo="Buscar dónde jugar" icono="buscar" onPress={() => navigation.navigate('Buscar')} />
      </View>
    );
  }

  const secciones = [
    { titulo: 'Próximas', data: reservas.proximas },
    { titulo: 'Anteriores', data: reservas.anteriores },
  ].filter(s => s.data.length > 0);

  return (
    <SectionList
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.lista}
      sections={secciones}
      keyExtractor={r => String(r.id)}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={[estilos.seccion, { color: colores.textoSecundario }]}>{section.titulo}</Text>
      )}
      renderItem={({ item }) => <TarjetaReserva reserva={item} onPress={() => navigation.navigate('Reserva', { id: item.id })} />}
      refreshControl={
        <RefreshControl
          refreshing={recargando}
          onRefresh={() => {
            setRecargando(true);
            cargar();
          }}
          colors={[colores.primario]}
        />
      }
    />
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vacio: { flex: 1, justifyContent: 'center', padding: espaciado.m },
  lista: { padding: espaciado.m, paddingBottom: espaciado.xl },
  seccion: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: espaciado.s,
    marginBottom: espaciado.s,
    marginLeft: espaciado.xs,
  },
});
