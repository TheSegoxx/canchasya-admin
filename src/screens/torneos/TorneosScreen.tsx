import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NOMBRE_DEPORTE } from '../../api/canchas';
import { NOMBRE_ESTADO_TORNEO, NOMBRE_FORMATO, Torneo, torneosApi } from '../../api/torneos';
import { Boton } from '../../components/Boton';
import { Icono } from '../../components/Icono';
import { mensajeDeError, useEsDueno } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';

// Torneos y ligas del complejo
export function TorneosScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const esDueno = useEsDueno();
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setTorneos((await torneosApi.listar()).torneos);
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

  const tarjeta = ({ item }: { item: Torneo }) => {
    const color = item.estado === 'en_curso' ? colores.primario : item.estado === 'finalizado' ? colores.inactivo : colores.senado;
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Torneo', { id: item.id })}
        style={({ pressed }) => [
          estilos.tarjeta,
          { backgroundColor: colores.superficie, borderColor: colores.borde, borderLeftColor: color, opacity: pressed ? 0.85 : 1 },
        ]}>
        <Icono nombre={item.deporte} color={colores.primario} tamano={28} />
        <View style={estilos.datos}>
          <Text style={[estilos.nombre, { color: colores.texto }]}>{item.nombre}</Text>
          <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
            {NOMBRE_DEPORTE[item.deporte]} · {NOMBRE_FORMATO[item.formato]} · {item.equipos}{' '}
            {item.deporte === 'padel' ? 'parejas' : 'equipos'}
          </Text>
        </View>
        <Text style={[estilos.estado, { color: colores.texto }]}>{NOMBRE_ESTADO_TORNEO[item.estado]}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <FlatList
        data={torneos}
        keyExtractor={t => String(t.id)}
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
        ListEmptyComponent={
          cargando ? undefined : error ? (
            <View>
              <Text style={[estilos.vacio, { color: colores.error }]}>{error}</Text>
              <Boton titulo="Reintentar" variante="secundario" onPress={cargar} />
            </View>
          ) : (
            <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>
              {esDueno
                ? 'Todavía no hay torneos. Tocá + para armar una liga o un torneo de eliminación.'
                : 'Todavía no hay torneos.'}
            </Text>
          )
        }
      />
      {esDueno && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nuevo torneo"
          onPress={() => navigation.navigate('NuevoTorneo')}
          style={({ pressed }) => [estilos.flotante, { backgroundColor: colores.primario, opacity: pressed ? 0.85 : 1 }]}>
          <Icono nombre="agregar" color={colores.textoSobrePrimario} tamano={28} />
        </Pressable>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  lista: { padding: espaciado.m, paddingBottom: 96 },
  vacio: { fontSize: 15, textAlign: 'center', paddingVertical: espaciado.xl, lineHeight: 21 },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingHorizontal: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    borderLeftWidth: 5,
    marginBottom: espaciado.s,
  },
  datos: { flex: 1, marginHorizontal: espaciado.m },
  nombre: { fontSize: 17, fontWeight: '700' },
  detalle: { fontSize: 13, marginTop: 2 },
  estado: { fontSize: 13, fontWeight: '700' },
  flotante: {
    position: 'absolute',
    right: espaciado.l,
    bottom: espaciado.l,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
