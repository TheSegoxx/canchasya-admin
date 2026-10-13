import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Agenda, agendaApi } from '../../api/agenda';
import { DetalleTorneo, torneosApi } from '../../api/torneos';
import { Boton } from '../../components/Boton';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Pantalla } from '../../components/Pantalla';
import { SelectorDia } from '../../components/SelectorDia';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { abrirWhatsApp } from '../../utils/acciones';
import { horariosLibres } from '../../utils/agenda';
import { hoyISO } from '../../utils/fechas';
import { minutosAhora } from '../../utils/horas';
import { nombreRonda, textoProgramacion, totalRondas } from '../../utils/torneos';

type Props = NativeStackScreenProps<RutasApp, 'Partido'>;

// Un partido del torneo: cargar el resultado y reservarle una cancha en la agenda
export function PartidoScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const { torneoId, partidoId } = route.params;
  const hoy = hoyISO();
  const [detalle, setDetalle] = useState<DetalleTorneo | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [local, setLocal] = useState(0);
  const [visitante, setVisitante] = useState(0);
  const [fecha, setFecha] = useState(hoy);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [canchaId, setCanchaId] = useState<number | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      const datos = await torneosApi.obtener(torneoId);
      setDetalle(datos);
      const p = datos.partidos.find(x => x.id === partidoId);
      if (p) {
        setLocal(p.resultadoLocal ?? 0);
        setVisitante(p.resultadoVisitante ?? 0);
        if (p.fecha && p.fecha >= hoyISO()) {
          setFecha(p.fecha);
        }
      }
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    }
  }, [torneoId, partidoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Canchas, horario del complejo y lo ocupado del día elegido
  useEffect(() => {
    let vigente = true;
    agendaApi
      .dia(fecha)
      .then(datos => vigente && setAgenda(datos))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [fecha]);

  const partido = detalle?.partidos.find(p => p.id === partidoId);
  if (!detalle || !partido) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const { torneo } = detalle;
  const equipo = (id: number | null) => detalle.equipos.find(e => e.id === id);
  const nombreLocal = equipo(partido.localId)?.nombre ?? 'A definir';
  const nombreVisitante = equipo(partido.visitanteId)?.nombre ?? 'A definir';
  const unidad = torneo.deporte === 'padel' ? 'Sets' : 'Goles';

  const canchas = (agenda?.fecha === fecha ? agenda.canchas : []).filter(c => c.habilitada && c.deporte === torneo.deporte);
  const cancha = canchas.find(c => c.id === canchaId) ?? canchas[0];
  const libres =
    agenda && cancha
      ? horariosLibres(cancha, {
          apertura: agenda.complejo.horaApertura,
          cierre: agenda.complejo.horaCierre,
          turnos: agenda.turnos,
          bloqueos: agenda.bloqueos,
          minutosAhora: fecha === hoy ? minutosAhora() : undefined,
        })
      : [];
  const horaElegida = hora && libres.includes(hora) ? hora : null;

  const ejecutar = async (accion: () => Promise<DetalleTorneo>, volver = false) => {
    setGuardando(true);
    try {
      setDetalle(await accion());
      if (volver) {
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert('No se pudo guardar', mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const contador = (titulo: string, valor: number, cambiar: (v: number) => void) => (
    <View style={[estilos.contador, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      <Text numberOfLines={2} style={[estilos.nombreEquipo, { color: colores.texto }]}>
        {titulo}
      </Text>
      <View style={estilos.botonesContador}>
        {(['−', '+'] as const).map(signo => {
          const delta = signo === '+' ? 1 : -1;
          const habilitado = valor + delta >= 0 && valor + delta <= 99;
          return (
            <Pressable
              key={signo}
              accessibilityRole="button"
              accessibilityLabel={`${titulo}: ${signo === '+' ? 'uno más' : 'uno menos'}`}
              disabled={!habilitado}
              onPress={() => cambiar(valor + delta)}
              style={[estilos.botonContador, { borderColor: colores.borde }, !habilitado && estilos.inhabilitado]}>
              <Text style={[estilos.signo, { color: colores.primario }]}>{signo}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text accessibilityLiveRegion="polite" style={[estilos.valor, { color: colores.texto }]}>
        {valor}
      </Text>
    </View>
  );

  const programado = textoProgramacion(partido);
  const avisar = (telefono: string | null | undefined) =>
    telefono &&
    abrirWhatsApp(
      telefono,
      `¡Hola! ${torneo.nombre}: ${nombreLocal} vs ${nombreVisitante} se juega el ${programado}. ¡Los esperamos!`,
    );

  return (
    <Pantalla>
      <Text style={[estilos.ronda, { color: colores.textoSecundario }]}>
        {torneo.nombre} · {nombreRonda(torneo.formato, partido.ronda, totalRondas(detalle.partidos))}
      </Text>

      <Text style={[estilos.seccion, { color: colores.texto }]}>Resultado ({unidad.toLowerCase()})</Text>
      {contador(nombreLocal, local, setLocal)}
      {contador(nombreVisitante, visitante, setVisitante)}
      <Boton
        titulo={partido.resultadoLocal === null ? 'Guardar resultado' : 'Corregir resultado'}
        onPress={() => ejecutar(() => torneosApi.cargarResultado(partido.id, local, visitante), true)}
        cargando={guardando}
      />
      {partido.resultadoLocal !== null && (
        <Boton
          titulo="Borrar resultado"
          variante="texto"
          color={colores.error}
          onPress={() => ejecutar(() => torneosApi.borrarResultado(partido.id))}
          deshabilitado={guardando}
        />
      )}

      <View style={[estilos.separador, { backgroundColor: colores.borde }]} />

      <Text style={[estilos.seccion, { color: colores.texto }]}>Cancha y horario</Text>
      {programado ? (
        <>
          <Text style={[estilos.programado, { color: colores.texto }]}>{programado}</Text>
          <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
            La cancha queda bloqueada en la agenda. Para cambiarlo elegí otro horario abajo.
          </Text>
          {[equipo(partido.localId), equipo(partido.visitanteId)].map(
            e =>
              e?.telefono && (
                <Boton
                  key={e.id}
                  titulo={`Avisarle a ${e.nombre}`}
                  icono="whatsapp"
                  variante="secundario"
                  color={colores.whatsapp}
                  onPress={() => avisar(e.telefono)}
                />
              ),
          )}
          <Boton
            titulo="Quitar de la agenda"
            variante="texto"
            color={colores.error}
            onPress={() => ejecutar(() => torneosApi.desprogramar(partido.id))}
            deshabilitado={guardando}
          />
        </>
      ) : (
        <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
          Elegí cancha, día y hora: la cancha queda reservada en la agenda para el partido.
        </Text>
      )}

      <SelectorDia etiqueta="Día" fecha={fecha} onCambiar={setFecha} minimo={hoy} />
      {canchas.length === 0 ? (
        <Text style={[estilos.ayuda, { color: colores.error }]}>
          {agenda ? 'No hay canchas habilitadas de este deporte.' : 'Cargando canchas…'}
        </Text>
      ) : (
        <>
          <View style={estilos.chips}>
            {canchas.map(c => (
              <Chip key={c.id} texto={c.nombre} seleccionado={c.id === cancha?.id} onPress={() => setCanchaId(c.id)} />
            ))}
          </View>
          <View style={estilos.horas}>
            {libres.map(h => (
              <Pressable
                key={h}
                accessibilityRole="radio"
                accessibilityState={{ checked: h === horaElegida }}
                onPress={() => setHora(h)}
                style={[
                  estilos.hora,
                  {
                    backgroundColor: h === horaElegida ? colores.primario : colores.superficie,
                    borderColor: h === horaElegida ? colores.primario : colores.borde,
                  },
                ]}>
                <Text style={[estilos.textoHora, { color: h === horaElegida ? colores.textoSobrePrimario : colores.texto }]}>
                  {h}
                </Text>
              </Pressable>
            ))}
          </View>
          <Boton
            titulo={programado ? 'Cambiar horario' : 'Programar partido'}
            variante="secundario"
            deshabilitado={!horaElegida || !cancha || guardando}
            onPress={() =>
              cancha &&
              horaElegida &&
              ejecutar(() => torneosApi.programar(partido.id, { canchaId: cancha.id, fecha, hora: horaElegida }))
            }
          />
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ronda: { fontSize: 14, marginBottom: espaciado.m },
  seccion: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.s },
  contador: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radio,
    padding: espaciado.s,
    paddingLeft: espaciado.m,
    marginBottom: espaciado.s,
  },
  nombreEquipo: { flex: 1, fontSize: 16, fontWeight: '600' },
  botonesContador: { flexDirection: 'row' },
  botonContador: {
    width: 44,
    height: 44,
    borderRadius: radio - 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: espaciado.xs,
  },
  inhabilitado: { opacity: 0.35 },
  signo: { fontSize: 24, fontWeight: '600' },
  valor: { width: 44, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  separador: { height: StyleSheet.hairlineWidth, marginVertical: espaciado.l },
  programado: { fontSize: 18, fontWeight: '700', marginBottom: espaciado.xs },
  ayuda: { fontSize: 14, lineHeight: 20, marginBottom: espaciado.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.s },
  horas: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.s },
  hora: {
    width: 72,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radio - 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: espaciado.s,
    marginBottom: espaciado.s,
  },
  textoHora: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
