import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NOMBRE_METODO } from '../../api/cobros';
import { dashboardApi, Movimiento, nombreCategoria, nombresCategorias } from '../../api/dashboard';
import { Boton } from '../../components/Boton';
import { Icono } from '../../components/Icono';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { fechaCorta } from '../../utils/fechas';
import { formatearPesos } from '../../utils/formato';

type Props = NativeStackScreenProps<RutasApp, 'Movimientos'>;

// Gastos y otros ingresos cargados a mano en un período (los cobros de turnos están en la caja)
export function MovimientosScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const { desde, hasta, titulo } = route.params;
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: titulo });
  }, [navigation, titulo]);

  const cargar = useCallback(async () => {
    try {
      setMovimientos((await dashboardApi.movimientos(desde, hasta)).movimientos);
      setError('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const borrar = (m: Movimiento) =>
    Alert.alert('Borrar', `${nombresCategorias(m)} de ${formatearPesos(m.monto)} del ${fechaCorta(m.fecha)}.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await dashboardApi.borrarMovimiento(m.id);
            setMovimientos(lista => lista.filter(x => x.id !== m.id));
          } catch (e) {
            Alert.alert('No se pudo borrar', mensajeDeError(e));
          }
        },
      },
    ]);

  const fila = ({ item }: { item: Movimiento }) => {
    const egreso = item.tipo === 'egreso';
    return (
      <View style={[estilos.fila, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        {/* El color identifica el tipo; el texto queda en color de texto */}
        <View style={[estilos.marca, { backgroundColor: egreso ? colores.serieEgresos : colores.serieIngresos }]} />
        <View style={estilos.datos}>
          <Text style={[estilos.categoria, { color: colores.texto }]}>{nombresCategorias(item)}</Text>
          {/* Con varias categorías, cuánto fue a cada una */}
          {item.categorias.length > 1 && (
            <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
              {item.categorias.map(c => `${nombreCategoria(item.tipo, c.categoria)} ${formatearPesos(c.monto)}`).join(' · ')}
            </Text>
          )}
          <Text numberOfLines={1} style={[estilos.detalle, { color: colores.textoSecundario }]}>
            {fechaCorta(item.fecha)} · {NOMBRE_METODO[item.metodo]}
            {item.descripcion ? ` · ${item.descripcion}` : ''}
          </Text>
        </View>
        <Text style={[estilos.monto, { color: colores.texto }]}>
          {egreso ? '−' : '+'}
          {formatearPesos(item.monto)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Borrar ${nombresCategorias(item)}`}
          onPress={() => borrar(item)}
          hitSlop={8}
          style={estilos.borrar}>
          <Icono nombre="borrar" color={colores.error} tamano={20} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <FlatList
        data={movimientos}
        keyExtractor={m => String(m.id)}
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
              No cargaste gastos ni otros ingresos en este período. Tocá + para agregar uno.
            </Text>
          )
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cargar un gasto o un ingreso"
        onPress={() => navigation.navigate('Movimiento', {})}
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
    minHeight: 60,
    paddingLeft: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    marginBottom: espaciado.s,
  },
  marca: { width: 10, height: 10, borderRadius: 5 },
  datos: { flex: 1, marginHorizontal: espaciado.s },
  categoria: { fontSize: 16, fontWeight: '600' },
  detalle: { fontSize: 13, marginTop: 2 },
  monto: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  borrar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
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
