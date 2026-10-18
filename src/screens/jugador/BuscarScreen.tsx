import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Deporte } from '../../api/canchas';
import type { Ubicacion } from '../../api/complejo';
import { ComplejoResumen, explorarApi } from '../../api/explorar';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import type { RutasJugador } from '../../navigation/AppNavigator';
import { espaciado, useTema } from '../../theme/tema';
import { ubicacionActual } from '../../ubicacion';
import { TarjetaComplejo } from './TarjetaComplejo';

const DEPORTES: { valor: Deporte | null; titulo: string }[] = [
  { valor: null, titulo: 'Todos' },
  { valor: 'padel', titulo: 'Pádel' },
  { valor: 'futbol5', titulo: 'Fútbol 5' },
];

// Pestaña "Buscar" del jugador: los complejos con filtros, cerca suyo o solo sus favoritos
export function BuscarScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasJugador>>();
  const { usuario } = useSesion();
  const margen = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  // Por defecto, el deporte que juega (si juega uno solo)
  const [deporte, setDeporte] = useState<Deporte | null>(usuario?.deportes.length === 1 ? usuario.deportes[0] : null);
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [desde, setDesde] = useState<Ubicacion | null>(null);
  const [ubicando, setUbicando] = useState(false);
  const [complejos, setComplejos] = useState<ComplejoResumen[] | null>(null);
  const [error, setError] = useState('');
  const [recargando, setRecargando] = useState(false);
  const pedido = useRef(0);

  // Espera a que se deje de escribir
  useEffect(() => {
    const espera = setTimeout(() => setBuscar(texto), 350);
    return () => clearTimeout(espera);
  }, [texto]);

  const cargar = useCallback(async () => {
    const numero = ++pedido.current;
    try {
      const { complejos: encontrados } = await explorarApi.buscar({
        buscar,
        deporte: deporte ?? undefined,
        favoritos: soloFavoritos,
        desde: desde ?? undefined,
      });
      // Si mientras tanto cambió un filtro, esta respuesta ya no sirve
      if (numero === pedido.current) {
        setComplejos(encontrados);
        setError('');
      }
    } catch (e) {
      if (numero === pedido.current) {
        setError(mensajeDeError(e));
      }
    } finally {
      setRecargando(false);
    }
  }, [buscar, deporte, soloFavoritos, desde]);

  // Al volver de la ficha se recarga (pudo cambiar un favorito)
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const alternarCerca = async () => {
    if (desde) {
      setDesde(null);
      return;
    }
    setUbicando(true);
    try {
      setDesde(await ubicacionActual('Para mostrarte los complejos más cerca, CanchasYa necesita la ubicación de este celular.'));
    } catch (e) {
      Alert.alert('Cerca mío', e instanceof Error ? e.message : 'No se pudo obtener la ubicación.');
    } finally {
      setUbicando(false);
    }
  };

  // Se marca al instante; si la API falla, vuelve atrás
  const alternarFavorito = async (complejo: ComplejoResumen) => {
    const nuevo = !complejo.favorito;
    const marcar = (valor: boolean) =>
      setComplejos(lista => lista?.map(c => (c.id === complejo.id ? { ...c, favorito: valor } : c)) ?? null);
    marcar(nuevo);
    try {
      await explorarApi.favorito(complejo.id, nuevo);
      if (!nuevo && soloFavoritos) {
        setComplejos(lista => lista?.filter(c => c.id !== complejo.id) ?? null);
      }
    } catch (e) {
      marcar(!nuevo);
      Alert.alert('Favoritos', mensajeDeError(e));
    }
  };

  const cabecera = (
    <View>
      <Text style={[estilos.hola, { color: colores.texto }]}>
        ¡Hola{usuario ? `, ${usuario.nombre.split(' ')[0]}` : ''}!
      </Text>
      <Text style={[estilos.pregunta, { color: colores.textoSecundario }]}>¿Dónde jugás hoy?</Text>
      <CampoTexto
        etiqueta="Buscar complejo, barrio o calle"
        value={texto}
        onChangeText={setTexto}
        placeholder="Ej.: Almagro"
        autoCorrect={false}
        returnKeyType="search"
      />
      <View style={estilos.chips}>
        {DEPORTES.map(d => (
          <Chip key={d.titulo} texto={d.titulo} seleccionado={deporte === d.valor} onPress={() => setDeporte(d.valor)} />
        ))}
      </View>
      <View style={estilos.chips}>
        <Chip texto={ubicando ? 'Buscando…' : 'Cerca mío'} seleccionado={!!desde} onPress={alternarCerca} />
        <Chip texto="Favoritos" seleccionado={soloFavoritos} onPress={() => setSoloFavoritos(!soloFavoritos)} />
      </View>
    </View>
  );

  const vacio =
    complejos === null ? (
      error ? (
        <ErrorCarga mensaje={error} onReintentar={cargar} />
      ) : (
        <ActivityIndicator style={estilos.cargando} size="large" color={colores.primario} />
      )
    ) : (
      <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>
        {soloFavoritos
          ? 'Todavía no guardaste favoritos. Tocá el corazón de un complejo para tenerlo a mano.'
          : 'No encontramos complejos con esa búsqueda.'}
      </Text>
    );

  return (
    <FlatList
      style={{ backgroundColor: colores.fondo }}
      // Sin barra de título: el saludo hace de encabezado, debajo de la barra de estado
      contentContainerStyle={[estilos.lista, { paddingTop: margen.top + espaciado.m }]}
      data={complejos ?? []}
      keyExtractor={c => String(c.id)}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={cabecera}
      ListEmptyComponent={vacio}
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
      renderItem={({ item }) => (
        <TarjetaComplejo
          complejo={item}
          onPress={() => navigation.navigate('ComplejoJugador', { id: item.id, nombre: item.nombre })}
          onFavorito={() => alternarFavorito(item)}
        />
      )}
    />
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espaciado.m, paddingBottom: espaciado.xl },
  hola: { fontSize: 26, fontWeight: '700' },
  pregunta: { fontSize: 16, marginBottom: espaciado.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.xs },
  cargando: { marginTop: espaciado.xl },
  vacio: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: espaciado.l, paddingHorizontal: espaciado.m },
});
