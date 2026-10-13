import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Cancha, canchasApi, Deporte, NOMBRE_DEPORTE } from '../../api/canchas';
import { urlDeFoto } from '../../api/cliente';
import { Boton } from '../../components/Boton';
import { Chip } from '../../components/Chip';
import { Icono } from '../../components/Icono';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { formatearPesos } from '../../utils/formato';

type Filtro = 'todas' | Deporte;

// Pestaña "Canchas": lista con interruptor Libre/Ocupada y acceso a crear o editar
export function CanchasScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [guardandoEstado, setGuardandoEstado] = useState<number[]>([]);

  const cargar = useCallback(async () => {
    try {
      const { canchas: lista } = await canchasApi.listar();
      setCanchas(lista);
      setError('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  // Se recarga cada vez que se vuelve a esta pestaña (por ejemplo, después de editar)
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const alternarEstado = async (cancha: Cancha) => {
    const nuevo = cancha.estado === 'libre' ? 'ocupada' : 'libre';
    // Se muestra el cambio al instante y se revierte si la API falla.
    // Mientras se guarda, el interruptor de esa cancha queda bloqueado.
    setGuardandoEstado(ids => [...ids, cancha.id]);
    setCanchas(lista => lista.map(c => (c.id === cancha.id ? { ...c, estado: nuevo } : c)));
    try {
      await canchasApi.cambiarEstado(cancha.id, nuevo);
    } catch (e) {
      setCanchas(lista => lista.map(c => (c.id === cancha.id ? { ...c, estado: cancha.estado } : c)));
      Alert.alert('No se pudo cambiar el estado', mensajeDeError(e));
    } finally {
      setGuardandoEstado(ids => ids.filter(i => i !== cancha.id));
    }
  };

  const visibles = filtro === 'todas' ? canchas : canchas.filter(c => c.deporte === filtro);

  const tarjeta = ({ item }: { item: Cancha }) => {
    const libre = item.estado === 'libre';
    const colorEstado = !item.habilitada ? colores.inactivo : libre ? colores.libre : colores.ocupada;
    const detalles = [
      NOMBRE_DEPORTE[item.deporte],
      item.techada ? 'Techada' : 'Descubierta',
      `${item.duracionMin} min`,
      item.superficie,
    ].filter(Boolean);

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Abre la cancha para editarla"
        onPress={() => navigation.navigate('Cancha', { id: item.id })}
        style={({ pressed }) => [
          estilos.tarjeta,
          {
            backgroundColor: colores.superficie,
            borderColor: colores.borde,
            borderLeftColor: colorEstado,
            opacity: pressed ? 0.85 : item.habilitada ? 1 : 0.6,
          },
        ]}>
        {item.foto ? (
          <Image source={{ uri: urlDeFoto(item.foto) }} style={[estilos.icono, { backgroundColor: colores.borde }]} />
        ) : (
          <View style={[estilos.icono, { backgroundColor: colores.fondo }]}>
            <Icono nombre={item.deporte} color={colores.primario} tamano={28} />
          </View>
        )}
        <View style={estilos.datos}>
          <Text style={[estilos.nombre, { color: colores.texto }]} numberOfLines={1}>
            {item.nombre}
          </Text>
          <Text style={[estilos.detalle, { color: colores.textoSecundario }]} numberOfLines={1}>
            {detalles.join(' · ')}
          </Text>
          <Text style={[estilos.precio, { color: colores.texto }]}>{formatearPesos(item.precioBase)} por turno</Text>
        </View>
        <View style={estilos.estado}>
          <Switch
            accessibilityLabel={`${item.nombre}: ${libre ? 'libre' : 'ocupada'}`}
            value={libre}
            onValueChange={() => alternarEstado(item)}
            disabled={!item.habilitada || guardandoEstado.includes(item.id)}
            trackColor={{ true: colores.libre, false: colores.ocupada }}
            thumbColor="#FFFFFF"
          />
          <Text style={[estilos.textoEstado, { color: colorEstado }]}>
            {!item.habilitada ? 'Deshabilitada' : libre ? 'Libre' : 'Ocupada'}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <View style={estilos.filtros}>
        {(['todas', 'padel', 'futbol5'] as Filtro[]).map(f => (
          <Chip
            key={f}
            texto={f === 'todas' ? 'Todas' : NOMBRE_DEPORTE[f]}
            seleccionado={filtro === f}
            onPress={() => setFiltro(f)}
          />
        ))}
      </View>

      {/* Si falla una recarga con canchas ya en pantalla, se avisa sin esconder la lista */}
      {!!error && canchas.length > 0 && (
        <Text accessibilityLiveRegion="polite" style={[estilos.aviso, { color: colores.error }]}>
          {error}
        </Text>
      )}

      <FlatList
        data={visibles}
        keyExtractor={c => String(c.id)}
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
          cargando ? undefined : (
            <View style={estilos.vacio}>
              {error ? (
                <>
                  <Text style={[estilos.textoVacio, { color: colores.error }]}>{error}</Text>
                  <Boton titulo="Reintentar" variante="secundario" onPress={cargar} />
                </>
              ) : (
                <Text style={[estilos.textoVacio, { color: colores.textoSecundario }]}>
                  {canchas.length === 0
                    ? 'Todavía no cargaste canchas. Tocá + para agregar la primera.'
                    : 'No hay canchas de este deporte.'}
                </Text>
              )}
            </View>
          )
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Agregar cancha"
        onPress={() => navigation.navigate('Cancha', {})}
        style={({ pressed }) => [
          estilos.flotante,
          { backgroundColor: colores.primario, opacity: pressed ? 0.85 : 1 },
        ]}>
        <Icono nombre="agregar" color={colores.textoSobrePrimario} tamano={28} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: espaciado.m, paddingTop: espaciado.m },
  aviso: { fontSize: 14, paddingHorizontal: espaciado.m, marginBottom: espaciado.s },
  lista: { paddingHorizontal: espaciado.m, paddingBottom: 96 },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    borderLeftWidth: 5,
    marginBottom: espaciado.s,
  },
  icono: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  datos: { flex: 1, marginHorizontal: espaciado.m },
  nombre: { fontSize: 17, fontWeight: '700' },
  detalle: { fontSize: 13, marginTop: 2 },
  precio: { fontSize: 15, fontWeight: '600', marginTop: espaciado.xs },
  estado: { alignItems: 'center', minWidth: 84 },
  textoEstado: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  vacio: { paddingTop: espaciado.xl, alignItems: 'stretch' },
  textoVacio: { fontSize: 15, textAlign: 'center', marginBottom: espaciado.m },
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
