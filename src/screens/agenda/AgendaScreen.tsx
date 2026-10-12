import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Agenda, agendaApi, Bloqueo, CanchaAgenda, Turno } from '../../api/agenda';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Icono, NombreIcono } from '../../components/Icono';
import { SelectorSemana } from '../../components/SelectorSemana';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { abrirWhatsApp } from '../../utils/acciones';
import { mensajeDeTurno } from '../../utils/agenda';
import { fechaRelativa, hoyISO } from '../../utils/fechas';
import { GrillaAgenda } from './GrillaAgenda';
import { ListaAgenda } from './ListaAgenda';

type Vista = 'grilla' | 'lista';

// Pestaña "Agenda": los turnos de un día en grilla (canchas × horarios) o en lista
export function AgendaScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const hoy = hoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [vista, setVista] = useState<Vista>('grilla');
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  // El error es del día en que falló la carga: al pasar a otro día no se muestra
  const [error, setError] = useState<{ fecha: string; mensaje: string } | null>(null);
  // La última fecha pedida: si llega tarde la respuesta de otro día, se descarta
  const pedida = useRef(fecha);

  const cargar = useCallback(async (dia: string) => {
    pedida.current = dia;
    try {
      const datos = await agendaApi.dia(dia);
      if (pedida.current === dia) {
        setAgenda(datos);
        setError(null);
      }
    } catch (e) {
      if (pedida.current === dia) {
        setError({ fecha: dia, mensaje: mensajeDeError(e) });
      }
    }
  }, []);

  // Al volver a la pestaña (por ejemplo, después de cargar un turno) se recarga
  useFocusEffect(
    useCallback(() => {
      cargar(fecha);
    }, [cargar, fecha]),
  );

  const nuevoTurno = (canchaId?: number, hora?: string) => navigation.navigate('NuevoTurno', { fecha, canchaId, hora });

  const agregar = () =>
    Alert.alert('Agregar', `¿Qué querés cargar para ${fechaRelativa(fecha).toLowerCase()}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Bloquear horario', onPress: () => navigation.navigate('Bloqueo', { fecha }) },
      { text: 'Nuevo turno', onPress: () => nuevoTurno() },
    ]);

  const verBloqueo = (bloqueo: Bloqueo, cancha: CanchaAgenda) =>
    Alert.alert(
      `${cancha.nombre} bloqueada`,
      `De ${bloqueo.horaDesde} a ${bloqueo.horaHasta}. Motivo: ${bloqueo.motivo}.`,
      [
        { text: 'Cerrar', style: 'cancel' },
        {
          text: 'Quitar bloqueo',
          style: 'destructive',
          onPress: async () => {
            try {
              await agendaApi.borrarBloqueo(bloqueo.id);
              cargar(fecha);
            } catch (e) {
              Alert.alert('No se pudo quitar', mensajeDeError(e));
            }
          },
        },
      ],
    );

  const escribir = (turno: Turno) => {
    if (!agenda) {
      return;
    }
    const cancha = agenda.canchas.find(c => c.id === turno.canchaId)?.nombre ?? '';
    abrirWhatsApp(
      turno.cliente.telefono,
      mensajeDeTurno(turno, { complejo: agenda.complejo.nombre, direccion: agenda.complejo.direccion, cancha }),
    );
  };

  const delDia = agenda?.fecha === fecha ? agenda : null;
  const mensajeError = error?.fecha === fecha ? error.mensaje : '';
  const esPasado = fecha < hoy;

  const botonVista = (valor: Vista, icono: NombreIcono, nombre: string) => (
    <Pressable
      key={valor}
      accessibilityRole="button"
      accessibilityLabel={`Ver en ${nombre}`}
      accessibilityState={{ selected: vista === valor }}
      onPress={() => setVista(valor)}
      style={[estilos.botonVista, vista === valor && { backgroundColor: colores.primario }]}>
      <Icono nombre={icono} color={vista === valor ? colores.textoSobrePrimario : colores.textoSecundario} tamano={20} />
    </Pressable>
  );

  let contenido: React.ReactNode;
  if (delDia) {
    contenido =
      vista === 'grilla' ? (
        <GrillaAgenda
          agenda={delDia}
          esHoy={fecha === hoy}
          esPasado={esPasado}
          onLibre={nuevoTurno}
          onTurno={t => navigation.navigate('Turno', { id: t.id })}
          onBloqueo={verBloqueo}
        />
      ) : (
        <ListaAgenda
          agenda={delDia}
          onTurno={t => navigation.navigate('Turno', { id: t.id })}
          onBloqueo={verBloqueo}
          onWhatsApp={escribir}
        />
      );
  } else if (mensajeError) {
    contenido = <ErrorCarga mensaje={mensajeError} onReintentar={() => cargar(fecha)} />;
  } else {
    contenido = (
      <View style={estilos.cargando}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <SelectorSemana fecha={fecha} hoy={hoy} onCambiar={setFecha} />

      <View style={estilos.barra}>
        <Text style={[estilos.fecha, { color: colores.texto }]} numberOfLines={1}>
          {fechaRelativa(fecha, hoy)}
        </Text>
        {fecha !== hoy && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setFecha(hoy)}
            hitSlop={6}
            style={[estilos.hoy, { borderColor: colores.primario }]}>
            <Text style={[estilos.textoHoy, { color: colores.primario }]}>Hoy</Text>
          </Pressable>
        )}
        <View style={[estilos.vistas, { borderColor: colores.borde }]}>
          {botonVista('grilla', 'grilla', 'grilla')}
          {botonVista('lista', 'lista', 'lista')}
        </View>
      </View>

      {/* Si falla una recarga con la agenda en pantalla, se avisa sin esconderla */}
      {!!mensajeError && delDia && (
        <Text accessibilityLiveRegion="polite" style={[estilos.aviso, { color: colores.error }]}>
          {mensajeError}
        </Text>
      )}

      {contenido}

      {!esPasado && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar turno o bloqueo"
          onPress={agregar}
          style={({ pressed }) => [estilos.flotante, { backgroundColor: colores.primario, opacity: pressed ? 0.85 : 1 }]}>
          <Icono nombre="agregar" color={colores.textoSobrePrimario} tamano={28} />
        </Pressable>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: espaciado.m,
    paddingVertical: espaciado.s,
  },
  fecha: { flex: 1, fontSize: 17, fontWeight: '700' },
  hoy: {
    minHeight: 36,
    paddingHorizontal: espaciado.m,
    borderWidth: 1.5,
    borderRadius: 18,
    justifyContent: 'center',
    marginRight: espaciado.s,
  },
  textoHoy: { fontSize: 14, fontWeight: '700' },
  vistas: { flexDirection: 'row', borderWidth: 1, borderRadius: radio, padding: 2 },
  botonVista: { width: 44, height: 36, borderRadius: radio - 3, alignItems: 'center', justifyContent: 'center' },
  aviso: { fontSize: 14, paddingHorizontal: espaciado.m, marginBottom: espaciado.s },
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
