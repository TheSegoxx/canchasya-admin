import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Agenda, agendaApi, Turno } from '../../api/agenda';
import { ErrorApi } from '../../api/cliente';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Icono } from '../../components/Icono';
import { Pantalla } from '../../components/Pantalla';
import { SelectorDia } from '../../components/SelectorDia';
import { SelectorHora } from '../../components/SelectorHora';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { abrirWhatsApp } from '../../utils/acciones';
import { mensajeDeTurno } from '../../utils/agenda';
import { hoyISO } from '../../utils/fechas';
import { sumarMinutos } from '../../utils/horas';

type Props = NativeStackScreenProps<RutasApp, 'Bloqueo'>;

const MOTIVOS = ['Lluvia', 'Mantenimiento', 'Evento', 'Otro'];

// Cerrar una o varias canchas un rato. Si hay turnos en ese horario se pueden cancelar
// y después avisarle a cada cliente por WhatsApp.
export function BloqueoScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const hoy = hoyISO();
  const [fecha, setFecha] = useState(route.params.fecha < hoy ? hoy : route.params.fecha);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [elegidas, setElegidas] = useState<number[]>(route.params.canchaId ? [route.params.canchaId] : []);
  const [desde, setDesde] = useState<string | null>(null);
  const [hasta, setHasta] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('Lluvia');
  const [otroMotivo, setOtroMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Después de bloquear: los turnos que se cancelaron, para avisarles
  const [cancelados, setCancelados] = useState<Turno[] | null>(null);
  const pedida = useRef(fecha);

  const cargar = useCallback(async (dia: string) => {
    pedida.current = dia;
    setErrorCarga('');
    try {
      const datos = await agendaApi.dia(dia);
      if (pedida.current === dia) {
        setAgenda(datos);
      }
    } catch (e) {
      if (pedida.current === dia) {
        setErrorCarga(mensajeDeError(e));
      }
    }
  }, []);

  useEffect(() => {
    cargar(fecha);
  }, [cargar, fecha]);

  if (!agenda) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={() => cargar(fecha)} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const { horaApertura, horaCierre } = agenda.complejo;
  // Por defecto, todo el horario del complejo
  const horaDesde = desde ?? horaApertura;
  const horaHasta = hasta ?? horaCierre;
  const canchas = agenda.canchas.filter(c => c.habilitada);
  const nombreCancha = (id: number) => agenda.canchas.find(c => c.id === id)?.nombre ?? '';

  const alternar = (id: number) =>
    setElegidas(actuales => (actuales.includes(id) ? actuales.filter(i => i !== id) : [...actuales, id]));
  const todas = canchas.length > 0 && canchas.every(c => elegidas.includes(c.id));

  const guardar = async (cancelarTurnos = false) => {
    if (guardando) {
      return;
    }
    const texto = motivo === 'Otro' ? otroMotivo.trim() : motivo;
    if (elegidas.length === 0) {
      setError('Elegí al menos una cancha.');
      return;
    }
    if (!texto) {
      setError('Escribí el motivo del bloqueo.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const respuesta = await agendaApi.crearBloqueo({
        canchaIds: elegidas,
        fecha,
        horaDesde,
        horaHasta,
        motivo: texto,
        cancelarTurnos,
      });
      if (respuesta.cancelados.length === 0) {
        navigation.goBack();
        return;
      }
      setCancelados(respuesta.cancelados);
    } catch (e) {
      // Hay turnos en ese horario: se muestran y se pregunta si cancelarlos
      const enConflicto: Turno[] | undefined = e instanceof ErrorApi ? e.datos?.turnosEnConflicto : undefined;
      if (enConflicto) {
        const lista = enConflicto
          .map(t => `• ${t.horaInicio} ${nombreCancha(t.canchaId)}: ${t.cliente.nombre}`)
          .join('\n');
        Alert.alert(
          mensajeDeError(e),
          `${lista}\n\nSi bloqueás igual, esos turnos se cancelan y después les podés avisar por WhatsApp.`,
          [
            { text: 'Volver', style: 'cancel' },
            { text: 'Cancelarlos y bloquear', style: 'destructive', onPress: () => guardar(true) },
          ],
        );
      } else {
        setError(mensajeDeError(e));
      }
    } finally {
      setGuardando(false);
    }
  };

  if (cancelados) {
    return (
      <Pantalla>
        <Text style={[estilos.titulo, { color: colores.primario }]}>✓ Horario bloqueado</Text>
        <Text style={[estilos.ayuda, { color: colores.texto }]}>
          Se cancelaron estos turnos. Tocá cada uno para avisarle al cliente por WhatsApp:
        </Text>
        {cancelados.map(t => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`Avisarle a ${t.cliente.nombre} por WhatsApp`}
            onPress={() =>
              abrirWhatsApp(
                t.cliente.telefono,
                mensajeDeTurno(t, {
                  complejo: agenda.complejo.nombre,
                  direccion: agenda.complejo.direccion,
                  ubicacion: agenda.complejo.ubicacion,
                  cancha: nombreCancha(t.canchaId),
                }),
              )
            }
            style={({ pressed }) => [
              estilos.cancelado,
              { backgroundColor: colores.superficie, borderColor: colores.borde, opacity: pressed ? 0.8 : 1 },
            ]}>
            <View style={estilos.datosCancelado}>
              <Text style={[estilos.nombre, { color: colores.texto }]}>{t.cliente.nombre}</Text>
              <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
                {t.horaInicio} · {nombreCancha(t.canchaId)}
              </Text>
            </View>
            <Icono nombre="whatsapp" color={colores.whatsapp} tamano={28} />
          </Pressable>
        ))}
        <View style={estilos.espacio} />
        <Boton titulo="Volver a la agenda" onPress={() => navigation.goBack()} />
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <SelectorDia etiqueta="Día" fecha={fecha} onCambiar={setFecha} minimo={hoy} />

      <Text style={[estilos.seccion, { color: colores.texto }]}>Canchas</Text>
      <View style={estilos.chips}>
        <Chip
          texto="Todas"
          seleccionado={todas}
          onPress={() => setElegidas(todas ? [] : canchas.map(c => c.id))}
        />
        {canchas.map(c => (
          <Chip key={c.id} texto={c.nombre} seleccionado={elegidas.includes(c.id)} onPress={() => alternar(c.id)} />
        ))}
      </View>

      <View style={estilos.horas}>
        <SelectorHora
          etiqueta="Desde"
          valor={horaDesde}
          onCambiar={setDesde}
          minimo={horaApertura}
          maximo={sumarMinutos(horaHasta, -30)}
        />
        <View style={estilos.separador} />
        <SelectorHora
          etiqueta="Hasta"
          valor={horaHasta}
          onCambiar={setHasta}
          minimo={sumarMinutos(horaDesde, 30)}
          maximo={horaCierre}
        />
      </View>

      <Text style={[estilos.seccion, { color: colores.texto }]}>Motivo</Text>
      <View style={estilos.chips}>
        {MOTIVOS.map(m => (
          <Chip key={m} texto={m} seleccionado={motivo === m} onPress={() => setMotivo(m)} />
        ))}
      </View>
      {motivo === 'Otro' && (
        <CampoTexto
          etiqueta="¿Cuál?"
          value={otroMotivo}
          onChangeText={setOtroMotivo}
          placeholder="Torneo, corte de luz…"
          maxLength={100}
        />
      )}

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo="Bloquear horario" onPress={() => guardar()} cargando={guardando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 20, fontWeight: '700', marginBottom: espaciado.s },
  seccion: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.s },
  ayuda: { fontSize: 15, lineHeight: 21, marginBottom: espaciado.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.s },
  horas: { flexDirection: 'row', marginBottom: espaciado.m },
  separador: { width: espaciado.m },
  error: { fontSize: 14, marginBottom: espaciado.m },
  cancelado: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: espaciado.m,
    borderWidth: 1,
    borderRadius: radio,
    marginBottom: espaciado.s,
  },
  datosCancelado: { flex: 1 },
  nombre: { fontSize: 16, fontWeight: '700' },
  detalle: { fontSize: 14, marginTop: 2 },
  espacio: { height: espaciado.m },
});
