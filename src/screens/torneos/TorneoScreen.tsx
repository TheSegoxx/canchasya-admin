import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NOMBRE_DEPORTE } from '../../api/canchas';
import { DetalleTorneo, NOMBRE_ESTADO_TORNEO, NOMBRE_FORMATO, Partido, torneosApi } from '../../api/torneos';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Icono } from '../../components/Icono';
import { mensajeDeError, useEsDueno } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { formatearTelefono } from '../../utils/telefono';
import { esLibre, nombreRonda, textoProgramacion, textoRonda, totalRondas } from '../../utils/torneos';

type Props = NativeStackScreenProps<RutasApp, 'Torneo'>;
type Seccion = 'equipos' | 'partidos' | 'tabla';

export function TorneoScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const esDueno = useEsDueno();
  const { id } = route.params;
  const [detalle, setDetalle] = useState<DetalleTorneo | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [seccion, setSeccion] = useState<Seccion | null>(null);
  const [nombre, setNombre] = useState('');
  const [integrantes, setIntegrantes] = useState('');
  const [telefono, setTelefono] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      setDetalle(await torneosApi.obtener(id));
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    }
  }, [id]);

  // Al volver de cargar un resultado se actualiza
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  useEffect(() => {
    if (detalle) {
      navigation.setOptions({ title: detalle.torneo.nombre });
    }
  }, [detalle, navigation]);

  if (!detalle) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const { torneo, equipos, partidos, tabla, campeonId } = detalle;
  const inscripcion = torneo.estado === 'inscripcion';
  const visible: Seccion = seccion ?? (inscripcion ? 'equipos' : 'partidos');
  const nombres = new Map(equipos.map(e => [e.id, e.nombre]));
  const nombreEquipo = (equipoId: number | null) => (equipoId !== null ? nombres.get(equipoId) ?? '?' : 'A definir');
  const palabraEquipos = torneo.deporte === 'padel' ? 'parejas' : 'equipos';

  const agregarEquipo = async () => {
    if (guardando) {
      return;
    }
    if (!nombre.trim()) {
      setError(`Poné el nombre ${torneo.deporte === 'padel' ? 'de la pareja' : 'del equipo'}.`);
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await torneosApi.agregarEquipo(id, { nombre: nombre.trim(), integrantes: integrantes.trim(), telefono: telefono.trim() });
      setNombre('');
      setIntegrantes('');
      setTelefono('');
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const confirmar = (titulo: string, texto: string, boton: string, accion: () => Promise<unknown>) =>
    Alert.alert(titulo, texto, [
      { text: 'Volver', style: 'cancel' },
      {
        text: boton,
        style: 'destructive',
        onPress: async () => {
          try {
            await accion();
          } catch (e) {
            Alert.alert('No se pudo', mensajeDeError(e));
          }
        },
      },
    ]);

  const sortear = () =>
    confirmar(
      'Sortear el fixture',
      `Se arma ${torneo.formato === 'liga' ? 'el fixture' : 'el cuadro'} al azar con ${equipos.length} ${palabraEquipos}. Después no se pueden agregar ni sacar.`,
      'Sortear',
      async () => {
        setDetalle(await torneosApi.sortear(id));
        setSeccion('partidos');
      },
    );

  const tarjetaPartido = (p: Partido) => {
    if (esLibre(p)) {
      return (
        <View key={p.id} style={[estilos.partido, { borderColor: colores.borde }]}>
          <Text style={[estilos.libre, { color: colores.textoSecundario }]}>
            {nombreEquipo(p.localId ?? p.visitanteId)} pasa directo
          </Text>
        </View>
      );
    }
    const jugable = p.localId !== null && p.visitanteId !== null;
    const cuando = textoProgramacion(p);
    const fila = (equipoId: number | null, goles: number | null) => {
      const gano = p.ganadorId !== null && p.ganadorId === equipoId;
      return (
        <View style={estilos.filaEquipo}>
          <Text numberOfLines={1} style={[estilos.equipo, { color: colores.texto }, gano && estilos.ganador]}>
            {gano ? '✓ ' : ''}
            {nombreEquipo(equipoId)}
          </Text>
          <Text style={[estilos.goles, { color: colores.texto }, gano && estilos.ganador]}>{goles ?? '–'}</Text>
        </View>
      );
    };
    return (
      <Pressable
        key={p.id}
        accessibilityRole="button"
        accessibilityHint="Cargar resultado o programar el partido"
        disabled={!jugable}
        onPress={() => navigation.navigate('Partido', { torneoId: id, partidoId: p.id })}
        style={({ pressed }) => [
          estilos.partido,
          { backgroundColor: colores.superficie, borderColor: colores.borde, opacity: pressed ? 0.85 : 1 },
        ]}>
        {fila(p.localId, p.resultadoLocal)}
        {fila(p.visitanteId, p.resultadoVisitante)}
        <Text style={[estilos.cuando, { color: cuando ? colores.textoSecundario : colores.inactivo }]}>
          {cuando ?? (jugable ? 'Sin programar' : 'Esperando rivales')}
        </Text>
      </Pressable>
    );
  };

  const rondas = Array.from({ length: totalRondas(partidos) }, (_, i) => i + 1);

  return (
    <ScrollView style={{ backgroundColor: colores.fondo }} contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Text style={[estilos.subtitulo, { color: colores.textoSecundario }]}>
        {NOMBRE_DEPORTE[torneo.deporte]} · {NOMBRE_FORMATO[torneo.formato]} · {NOMBRE_ESTADO_TORNEO[torneo.estado]}
      </Text>

      {campeonId !== null && (
        <View style={[estilos.campeon, { backgroundColor: colores.superficie, borderColor: colores.senado }]}>
          <Text style={estilos.copa}>🏆</Text>
          <View>
            <Text style={[estilos.tituloCampeon, { color: colores.textoSecundario }]}>Campeón</Text>
            <Text style={[estilos.nombreCampeon, { color: colores.texto }]}>{nombreEquipo(campeonId)}</Text>
          </View>
        </View>
      )}

      <View style={estilos.chips}>
        <Chip texto={`${palabraEquipos.charAt(0).toUpperCase() + palabraEquipos.slice(1)} (${equipos.length})`} seleccionado={visible === 'equipos'} onPress={() => setSeccion('equipos')} />
        {!inscripcion && <Chip texto="Partidos" seleccionado={visible === 'partidos'} onPress={() => setSeccion('partidos')} />}
        {!inscripcion && tabla && <Chip texto="Tabla" seleccionado={visible === 'tabla'} onPress={() => setSeccion('tabla')} />}
      </View>

      {visible === 'equipos' && (
        <>
          {equipos.map(e => (
            <View key={e.id} style={[estilos.fila, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
              <View style={estilos.datos}>
                <Text style={[estilos.equipo, { color: colores.texto }]}>{e.nombre}</Text>
                {(!!e.integrantes || !!e.telefono) && (
                  <Text style={[estilos.cuando, { color: colores.textoSecundario }]}>
                    {[e.integrantes, e.telefono && formatearTelefono(e.telefono)].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              {inscripcion && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Sacar a ${e.nombre}`}
                  onPress={() =>
                    confirmar('Sacar del torneo', e.nombre, 'Sacar', async () => {
                      await torneosApi.borrarEquipo(e.id);
                      await cargar();
                    })
                  }
                  hitSlop={8}
                  style={estilos.borrar}>
                  <Icono nombre="borrar" color={colores.error} tamano={20} />
                </Pressable>
              )}
            </View>
          ))}

          {inscripcion && (
            <View style={[estilos.formulario, { borderTopColor: colores.borde }]}>
              <CampoTexto
                etiqueta={torneo.deporte === 'padel' ? 'Nombre de la pareja' : 'Nombre del equipo'}
                value={nombre}
                onChangeText={setNombre}
                placeholder={torneo.deporte === 'padel' ? 'Gómez / Pérez' : 'Los Pibes'}
                maxLength={60}
              />
              <CampoTexto
                etiqueta="Integrantes (opcional)"
                value={integrantes}
                onChangeText={setIntegrantes}
                placeholder="Juan, Pedro, Lucas…"
                maxLength={150}
              />
              <CampoTexto
                etiqueta="Celular de contacto (opcional)"
                value={telefono}
                onChangeText={setTelefono}
                placeholder="11 5555 1234"
                keyboardType="phone-pad"
                maxLength={30}
              />
              {!!error && (
                <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
                  {error}
                </Text>
              )}
              <Boton titulo="Agregar" variante="secundario" onPress={agregarEquipo} cargando={guardando} />
              {esDueno && equipos.length >= 2 && (
                <>
                  <View style={estilos.espacio} />
                  <Boton titulo={`Sortear ${torneo.formato === 'liga' ? 'el fixture' : 'el cuadro'}`} onPress={sortear} />
                </>
              )}
            </View>
          )}
        </>
      )}

      {visible === 'partidos' &&
        rondas.map(ronda => (
          <View key={ronda} style={estilos.ronda}>
            <View style={estilos.cabeceraRonda}>
              <Text style={[estilos.tituloRonda, { color: colores.texto }]}>
                {nombreRonda(torneo.formato, ronda, rondas.length)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Compartir por WhatsApp"
                onPress={() => Share.share({ message: textoRonda(detalle, ronda) })}
                hitSlop={8}
                style={estilos.compartir}>
                <Icono nombre="whatsapp" color={colores.whatsapp} tamano={22} />
              </Pressable>
            </View>
            {partidos.filter(p => p.ronda === ronda).map(tarjetaPartido)}
          </View>
        ))}

      {visible === 'tabla' && tabla && (
        <View style={[estilos.tabla, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
          <View style={[estilos.filaTabla, { borderBottomColor: colores.borde }]}>
            {['#', 'Equipo', 'PJ', 'G', 'E', 'P', 'DG', 'Pts'].map((t, i) => (
              <Text key={t} style={[i === 1 ? estilos.celdaNombre : estilos.celda, estilos.encabezado, { color: colores.textoSecundario }]}>
                {t}
              </Text>
            ))}
          </View>
          {tabla.map((f, i) => (
            <View key={f.equipoId} style={[estilos.filaTabla, { borderBottomColor: colores.borde }]}>
              {[
                String(i + 1),
                nombreEquipo(f.equipoId),
                String(f.jugados),
                String(f.ganados),
                String(f.empatados),
                String(f.perdidos),
                String(f.aFavor - f.enContra),
                String(f.puntos),
              ].map((valor, j) => (
                <Text
                  key={j}
                  numberOfLines={1}
                  style={[j === 1 ? estilos.celdaNombre : estilos.celda, { color: colores.texto }, j === 7 && estilos.ganador]}>
                  {valor}
                </Text>
              ))}
            </View>
          ))}
          <Text style={[estilos.nota, { color: colores.textoSecundario }]}>
            {torneo.deporte === 'padel' ? 'DG: diferencia de sets.' : 'DG: diferencia de goles.'} Ganado 3 puntos, empate 1.
          </Text>
        </View>
      )}

      {esDueno && (
        <View style={estilos.borrarTorneo}>
          <Boton
            titulo="Borrar torneo"
            variante="texto"
            color={colores.error}
            onPress={() =>
              confirmar(
                'Borrar torneo',
                'Se borran los equipos, los partidos y las reservas de cancha de sus partidos. No se puede deshacer.',
                'Borrar',
                async () => {
                  await torneosApi.borrar(id);
                  navigation.goBack();
                },
              )
            }
          />
        </View>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenido: { padding: espaciado.m, paddingBottom: espaciado.xl },
  subtitulo: { fontSize: 14, marginBottom: espaciado.m },
  campeon: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espaciado.m,
    borderRadius: radio,
    borderWidth: 1.5,
    marginBottom: espaciado.m,
  },
  copa: { fontSize: 36, marginRight: espaciado.m },
  tituloCampeon: { fontSize: 13, fontWeight: '700' },
  nombreCampeon: { fontSize: 20, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.s },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingLeft: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    marginBottom: espaciado.s,
  },
  datos: { flex: 1, paddingVertical: espaciado.s },
  borrar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  formulario: { marginTop: espaciado.m, paddingTop: espaciado.m, borderTopWidth: StyleSheet.hairlineWidth },
  error: { fontSize: 14, marginBottom: espaciado.m },
  espacio: { height: espaciado.s },
  ronda: { marginBottom: espaciado.m },
  cabeceraRonda: { flexDirection: 'row', alignItems: 'center', marginBottom: espaciado.s },
  tituloRonda: { flex: 1, fontSize: 17, fontWeight: '700' },
  compartir: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  partido: { borderWidth: 1, borderRadius: radio, padding: espaciado.m, marginBottom: espaciado.s },
  filaEquipo: { flexDirection: 'row', alignItems: 'center', minHeight: 26 },
  equipo: { flex: 1, fontSize: 16 },
  ganador: { fontWeight: '800' },
  goles: { fontSize: 18, minWidth: 28, textAlign: 'right', fontVariant: ['tabular-nums'] },
  cuando: { fontSize: 13, marginTop: espaciado.xs },
  libre: { fontSize: 14, fontStyle: 'italic' },
  tabla: { borderWidth: 1, borderRadius: radio, paddingHorizontal: espaciado.s, paddingBottom: espaciado.s },
  filaTabla: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderBottomWidth: StyleSheet.hairlineWidth },
  encabezado: { fontSize: 12, fontWeight: '700' },
  celda: { width: 30, fontSize: 14, textAlign: 'center', fontVariant: ['tabular-nums'] },
  celdaNombre: { flex: 1, fontSize: 14, paddingRight: espaciado.xs },
  nota: { fontSize: 12, marginTop: espaciado.s },
  borrarTorneo: { marginTop: espaciado.l },
});
