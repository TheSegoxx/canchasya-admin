import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Deporte } from '../../api/canchas';
import { jugadorApi, NOMBRE_NIVEL, Partido } from '../../api/jugador';
import { Boton } from '../../components/Boton';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Icono } from '../../components/Icono';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import { espaciado, radio, useTema } from '../../theme/tema';
import { abrirWhatsApp } from '../../utils/acciones';
import { fechaRelativa } from '../../utils/fechas';

const DEPORTES: { valor: Deporte | null; titulo: string }[] = [
  { valor: null, titulo: 'Todos' },
  { valor: 'padel', titulo: 'Pádel' },
  { valor: 'futbol5', titulo: 'Fútbol 5' },
];

// Pestaña "Partidos": los que buscan jugadores ("me falta uno") para sumarse
export function PartidosScreen() {
  const { colores } = useTema();
  const { usuario } = useSesion();
  const margen = useSafeAreaInsets();
  const [deporte, setDeporte] = useState<Deporte | null>(usuario?.deportes.length === 1 ? usuario.deportes[0] : null);
  const [partidos, setPartidos] = useState<Partido[] | null>(null);
  const [error, setError] = useState('');
  const [recargando, setRecargando] = useState(false);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      setPartidos((await jugadorApi.partidos(deporte ?? undefined)).partidos);
      setError('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setRecargando(false);
    }
  }, [deporte]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const reemplazar = (p: Partido) => setPartidos(lista => lista?.map(x => (x.id === p.id ? p : x)) ?? null);

  const sumarme = (p: Partido) =>
    Alert.alert(
      'Sumarme al partido',
      `${p.cancha} en ${p.complejo.nombre}, ${fechaRelativa(p.fecha).toLowerCase()} a las ${p.horaInicio}.\n\n` +
        `${p.organizador} va a ver tu nombre y tu celular para coordinar (y vos el suyo).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Me sumo',
          onPress: async () => {
            setOcupado(p.id);
            try {
              reemplazar((await jugadorApi.sumarme(p.id)).partido);
            } catch (e) {
              Alert.alert('No se pudo', mensajeDeError(e));
              cargar();
            } finally {
              setOcupado(null);
            }
          },
        },
      ],
    );

  const bajarme = async (p: Partido) => {
    setOcupado(p.id);
    try {
      reemplazar((await jugadorApi.bajarme(p.id)).partido);
    } catch (e) {
      Alert.alert('No se pudo', mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  };

  const cabecera = (
    <View>
      <Text style={[estilos.titulo, { color: colores.texto }]}>Me falta uno</Text>
      <Text style={[estilos.subtitulo, { color: colores.textoSecundario }]}>
        Partidos que buscan jugadores. Sumate y coordiná por WhatsApp.
      </Text>
      <View style={estilos.chips}>
        {DEPORTES.map(d => (
          <Chip key={d.titulo} texto={d.titulo} seleccionado={deporte === d.valor} onPress={() => setDeporte(d.valor)} />
        ))}
      </View>
    </View>
  );

  const vacio =
    partidos === null ? (
      error ? (
        <ErrorCarga mensaje={error} onReintentar={cargar} />
      ) : (
        <ActivityIndicator style={estilos.cargando} size="large" color={colores.primario} />
      )
    ) : (
      <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>
        Ahora no hay partidos buscando jugadores. Cuando reserves, desde tu reserva podés publicar "Me falta uno".
      </Text>
    );

  return (
    <FlatList
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={[estilos.lista, { paddingTop: margen.top + espaciado.m }]}
      data={partidos ?? []}
      keyExtractor={p => String(p.id)}
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
        <TarjetaPartido partido={item} ocupado={ocupado === item.id} onSumarme={() => sumarme(item)} onBajarme={() => bajarme(item)} />
      )}
    />
  );
}

function TarjetaPartido({
  partido: p,
  ocupado,
  onSumarme,
  onBajarme,
}: {
  partido: Partido;
  ocupado: boolean;
  onSumarme: () => void;
  onBajarme: () => void;
}) {
  const { colores } = useTema();
  const lugar = [p.complejo.nombre, p.complejo.ciudad].filter(Boolean).join(' · ');
  return (
    <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: p.sumado ? colores.primario : colores.borde }]}>
      <View style={estilos.cabeceraTarjeta}>
        <View style={[estilos.icono, { backgroundColor: colores.primario + '1A' }]}>
          <Icono nombre={p.deporte} color={colores.primario} tamano={22} />
        </View>
        <View style={estilos.datos}>
          <Text style={[estilos.faltan, { color: colores.texto }]}>
            {p.sumado ? 'Estás en este partido ✓' : p.faltan === 1 ? 'Falta 1 jugador' : `Faltan ${p.faltan} jugadores`}
          </Text>
          <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
            {fechaRelativa(p.fecha)} · {p.horaInicio} a {p.horaFin === '24:00' ? '00:00' : p.horaFin}
          </Text>
        </View>
        <Text style={[estilos.nivel, { color: colores.primario, borderColor: colores.primario + '66' }]}>{NOMBRE_NIVEL[p.nivel]}</Text>
      </View>
      <Text style={[estilos.lugar, { color: colores.texto }]}>
        {p.cancha} · {lugar}
      </Text>
      {!!p.comentario && <Text style={[estilos.comentario, { color: colores.textoSecundario }]}>“{p.comentario}”</Text>}
      <Text style={[estilos.organiza, { color: colores.textoSecundario }]}>Organiza {p.organizador}</Text>

      {p.sumado ? (
        <View style={estilos.fila}>
          {p.telefonoOrganizador && (
            <View style={estilos.mitad}>
              <Boton
                titulo={`Escribirle a ${p.organizador}`}
                icono="whatsapp"
                variante="secundario"
                onPress={() =>
                  abrirWhatsApp(
                    p.telefonoOrganizador ?? '',
                    `¡Hola ${p.organizador}! Me sumé a tu partido en ${p.complejo.nombre}, ${fechaRelativa(p.fecha).toLowerCase()} a las ${p.horaInicio}.`,
                  )
                }
              />
            </View>
          )}
          <View style={estilos.mitadChica}>
            <Boton titulo="Bajarme" variante="texto" color={colores.error} onPress={onBajarme} cargando={ocupado} />
          </View>
        </View>
      ) : (
        <View style={estilos.accion}>
          <Boton titulo="Me sumo" onPress={onSumarme} cargando={ocupado} />
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espaciado.m, paddingBottom: espaciado.xl },
  titulo: { fontSize: 26, fontWeight: '700' },
  subtitulo: { fontSize: 15, lineHeight: 21, marginBottom: espaciado.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.xs },
  cargando: { marginTop: espaciado.xl },
  vacio: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: espaciado.l, paddingHorizontal: espaciado.m },
  tarjeta: { borderWidth: 1, borderRadius: radio, padding: espaciado.m, marginBottom: espaciado.m },
  cabeceraTarjeta: { flexDirection: 'row', alignItems: 'center' },
  icono: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  datos: { flex: 1, marginHorizontal: espaciado.m },
  faltan: { fontSize: 17, fontWeight: '700' },
  detalle: { fontSize: 14, marginTop: 2 },
  nivel: { fontSize: 12, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  lugar: { fontSize: 15, fontWeight: '500', marginTop: espaciado.s },
  comentario: { fontSize: 14, fontStyle: 'italic', marginTop: 4 },
  organiza: { fontSize: 13, marginTop: 4 },
  accion: { marginTop: espaciado.m },
  fila: { flexDirection: 'row', alignItems: 'center', marginTop: espaciado.m },
  mitad: { flex: 1, marginRight: espaciado.s },
  mitadChica: { minWidth: 100 },
});
