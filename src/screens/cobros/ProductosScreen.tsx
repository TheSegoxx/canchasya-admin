import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { cobrosApi, Producto } from '../../api/cobros';
import { Boton } from '../../components/Boton';
import { Icono } from '../../components/Icono';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { formatearPesos } from '../../utils/formato';

// Catálogo de extras del complejo: lo que se vende o alquila además del turno
export function ProductosScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setProductos((await cobrosApi.productos()).productos);
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

  const fila = ({ item }: { item: Producto }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Abre el producto para editarlo"
      onPress={() => navigation.navigate('Producto', { producto: item })}
      style={({ pressed }) => [
        estilos.fila,
        {
          backgroundColor: colores.superficie,
          borderColor: colores.borde,
          opacity: pressed ? 0.85 : item.activo ? 1 : 0.55,
        },
      ]}>
      <Text style={[estilos.nombre, { color: colores.texto }]}>{item.nombre}</Text>
      <Text style={[estilos.precio, { color: item.activo ? colores.texto : colores.textoSecundario }]}>
        {item.activo ? formatearPesos(item.precio) : 'Desactivado'}
      </Text>
    </Pressable>
  );

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <FlatList
        data={productos}
        keyExtractor={p => String(p.id)}
        renderItem={fila}
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
              Cargá lo que vendés o alquilás: paletas, tubos de pelotas, bebidas… Tocá + para agregar el primero.
            </Text>
          )
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Agregar producto"
        onPress={() => navigation.navigate('Producto', {})}
        style={({ pressed }) => [estilos.flotante, { backgroundColor: colores.primario, opacity: pressed ? 0.85 : 1 }]}>
        <Icono nombre="agregar" color={colores.textoSobrePrimario} tamano={28} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  lista: { padding: espaciado.m, paddingBottom: 96 },
  vacio: { fontSize: 15, textAlign: 'center', paddingVertical: espaciado.xl, lineHeight: 21 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    marginBottom: espaciado.s,
  },
  nombre: { flex: 1, fontSize: 16, fontWeight: '600' },
  precio: { fontSize: 16, fontWeight: '700' },
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
