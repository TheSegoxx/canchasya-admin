import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Espera, jugadorApi } from '../../api/jugador';
import { Reserva, reservasApi } from '../../api/reservas';
import { Boton } from '../../components/Boton';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Proximamente } from '../../components/Proximamente';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasJugador, RutasPestanasJugador } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { fechaRelativa } from '../../utils/fechas';
import { TarjetaReserva } from './TarjetaReserva';

// Pestaña "Mis reservas" del jugador: las próximas primero y después las anteriores
export function MisReservasScreen() {
  const { colores } = useTema();
  const navigation =
    useNavigation<
      CompositeNavigationProp<BottomTabNavigationProp<RutasPestanasJugador, 'MisReservas'>, NativeStackNavigationProp<RutasJugador>>
    >();
  const [reservas, setReservas] = useState<{ proximas: Reserva[]; anteriores: Reserva[] } | null>(null);
  const [esperas, setEsperas] = useState<Espera[]>([]);
  const [error, setError] = useState('');
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [lista, enEspera] = await Promise.all([reservasApi.listar(), jugadorApi.esperas()]);
      setReservas(lista);
      setEsperas(enEspera.esperas);
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

  const quitarEspera = (e: Espera) =>
    Alert.alert('Lista de espera', `¿Dejás de esperar ${e.cancha}, ${fechaRelativa(e.fecha).toLowerCase()} a las ${e.horaInicio}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            await jugadorApi.borrarEspera(e.id);
            setEsperas(lista => lista.filter(x => x.id !== e.id));
          } catch (e2) {
            Alert.alert('No se pudo quitar', mensajeDeError(e2));
          }
        },
      },
    ]);

  if (reservas.proximas.length === 0 && reservas.anteriores.length === 0 && esperas.length === 0) {
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

  // Arriba de las reservas: los horarios que espera que se liberen
  const listaDeEspera =
    esperas.length === 0 ? undefined : (
      <View>
        <Text style={[estilos.seccion, { color: colores.textoSecundario }]}>Lista de espera</Text>
        {esperas.map(e => (
          <View key={e.id} style={[estilos.espera, { backgroundColor: colores.superficie, borderColor: e.avisada ? colores.primario : colores.borde }]}>
            <View style={estilos.datosEspera}>
              <Text style={[estilos.tituloEspera, { color: colores.texto }]}>
                {e.cancha} · {fechaRelativa(e.fecha)} {e.horaInicio}
              </Text>
              <Text style={[estilos.detalleEspera, { color: e.avisada ? colores.primario : colores.textoSecundario }]}>
                {e.avisada ? `¡Se liberó! Reservalo antes que otro · ${e.complejo}` : `Esperando que se libere · ${e.complejo}`}
              </Text>
            </View>
            {e.avisada ? (
              <Boton titulo="Reservar" variante="texto" onPress={() => navigation.navigate('Reservar', { complejoId: e.complejoId, canchaId: e.canchaId })} />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quitar de la lista de espera"
                onPress={() => quitarEspera(e)}
                hitSlop={8}
                style={estilos.quitar}>
                <Text style={[estilos.cruz, { color: colores.textoSecundario }]}>✕</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    );

  return (
    <SectionList
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.lista}
      sections={secciones}
      keyExtractor={r => String(r.id)}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={listaDeEspera}
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
  espera: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radio,
    paddingVertical: espaciado.s,
    paddingLeft: espaciado.m,
    paddingRight: espaciado.s,
    marginBottom: espaciado.s,
  },
  datosEspera: { flex: 1 },
  tituloEspera: { fontSize: 15, fontWeight: '600' },
  detalleEspera: { fontSize: 13, marginTop: 2 },
  quitar: { padding: espaciado.s },
  cruz: { fontSize: 18 },
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
