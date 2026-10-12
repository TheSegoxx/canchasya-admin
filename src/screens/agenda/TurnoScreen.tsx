import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { agendaApi, EstadoTurno, NOMBRE_ESTADO, NOMBRE_PAGO, TurnoDetalle } from '../../api/agenda';
import { cobrosApi } from '../../api/cobros';
import { NOMBRE_DEPORTE } from '../../api/canchas';
import { Boton } from '../../components/Boton';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Icono } from '../../components/Icono';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { abrirWhatsApp, llamar } from '../../utils/acciones';
import { mensajeDeTurno } from '../../utils/agenda';
import { diaEnPlural, fechaCorta, fechaRelativa, hoyISO } from '../../utils/fechas';
import { formatearTelefono } from '../../utils/telefono';
import { CuentaTurno } from '../cobros/CuentaTurno';
import { colorDeTurno } from './GrillaAgenda';

type Props = NativeStackScreenProps<RutasApp, 'Turno'>;

// Detalle de un turno: avisar por WhatsApp, llamar, cobrar, cancelar o marcar como jugado
export function TurnoScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const { id, recienCreado } = route.params;
  const [turno, setTurno] = useState<TurnoDetalle | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      const { turno: datos } = await agendaApi.obtenerTurno(id);
      setTurno(datos);
      // Si hay links de Mercado Pago esperando, se consulta si ya los pagaron
      if (datos.linksPago.some(l => l.estado === 'pendiente')) {
        cobrosApi
          .verificarLinks(id)
          .then(respuesta => {
            setTurno(respuesta.turno);
            if (respuesta.aviso) {
              Alert.alert('Mercado Pago', respuesta.aviso);
            }
          })
          .catch(() => undefined); // sin conexión con Mercado Pago se reintenta al volver a abrir
      }
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    }
  }, [id]);

  useEffect(() => {
    navigation.setOptions({ title: recienCreado ? 'Turno reservado' : 'Turno' });
  }, [navigation, recienCreado]);

  // También al volver de cobrar o de agregar un extra
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (!turno) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const cambiarEstado = async (estado: EstadoTurno) => {
    setGuardando(true);
    try {
      setTurno((await agendaApi.cambiarEstado(turno.id, estado)).turno);
    } catch (e) {
      Alert.alert('No se pudo cambiar el turno', mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  // Este turno y todos los que siguen (la API no acepta bajas hacia atrás)
  const darDeBajaFijo = async () => {
    if (!turno.fijo) {
      return;
    }
    const hoy = hoyISO();
    const desde = turno.fecha < hoy ? hoy : turno.fecha;
    setGuardando(true);
    try {
      const { aviso } = await agendaApi.darDeBajaFijo(turno.fijo.id, desde);
      setTurno((await agendaApi.obtenerTurno(turno.id)).turno);
      Alert.alert(
        'Turno fijo dado de baja',
        `Ya no se reserva más los ${diaEnPlural(turno.fijo.diaSemana)}.${aviso ? `\n\n${aviso}` : ''}`,
      );
    } catch (e) {
      Alert.alert('No se pudo dar de baja', mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const confirmarCancelacion = () => {
    const pregunta = `${turno.cliente.nombre}, ${fechaRelativa(turno.fecha).toLowerCase()} a las ${turno.horaInicio}.`;
    if (turno.fijo) {
      Alert.alert('Cancelar turno fijo', `${pregunta}\n\n¿Cancelás solo este día o el turno fijo completo?`, [
        { text: 'Volver', style: 'cancel' },
        { text: 'Todos desde este', style: 'destructive', onPress: darDeBajaFijo },
        { text: 'Solo este día', onPress: () => cambiarEstado('cancelado') },
      ]);
    } else {
      Alert.alert('Cancelar turno', `${pregunta}\n\n¿Seguro que querés cancelarlo?`, [
        { text: 'Volver', style: 'cancel' },
        { text: 'Cancelar turno', style: 'destructive', onPress: () => cambiarEstado('cancelado') },
      ]);
    }
  };

  const mensaje = mensajeDeTurno(turno, {
    complejo: turno.complejo.nombre,
    direccion: turno.complejo.direccion,
    cancha: turno.cancha.nombre,
  });
  const color = colorDeTurno(turno, colores);
  const cancelado = turno.estado === 'cancelado';

  const fila = (etiqueta: string, valor: string, colorValor = colores.texto) => (
    <View style={[estilos.fila, { borderBottomColor: colores.borde }]}>
      <Text style={[estilos.etiqueta, { color: colores.textoSecundario }]}>{etiqueta}</Text>
      <Text style={[estilos.valor, { color: colorValor }]}>{valor}</Text>
    </View>
  );

  return (
    <Pantalla>
      {recienCreado && !cancelado && (
        <Text accessibilityLiveRegion="polite" style={[estilos.aviso, { color: colores.primario }]}>
          ✓ Turno reservado. Mandale la confirmación al cliente:
        </Text>
      )}

      <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.borde, borderLeftColor: color }]}>
        <View style={estilos.cabecera}>
          <Icono nombre="persona" color={colores.primario} tamano={28} />
          <View style={estilos.cliente}>
            <Text style={[estilos.nombre, { color: colores.texto }]}>{turno.cliente.nombre}</Text>
            <Text style={[estilos.telefono, { color: colores.textoSecundario }]}>
              {formatearTelefono(turno.cliente.telefono)}
            </Text>
          </View>
        </View>
        <Boton
          titulo={cancelado ? 'Avisar la cancelación' : 'Enviar por WhatsApp'}
          icono="whatsapp"
          color={colores.whatsapp}
          onPress={() => abrirWhatsApp(turno.cliente.telefono, mensaje)}
        />
        <View style={estilos.espacio} />
        <Boton titulo="Llamar" icono="telefono" variante="secundario" onPress={() => llamar(turno.cliente.telefono)} />
      </View>

      {fila('Día', `${fechaRelativa(turno.fecha)} (${fechaCorta(turno.fecha)})`)}
      {fila('Horario', `${turno.horaInicio} a ${turno.horaFin}`)}
      {fila('Cancha', `${turno.cancha.nombre} · ${NOMBRE_DEPORTE[turno.cancha.deporte]}`)}
      {fila('Estado', NOMBRE_ESTADO[turno.estado], cancelado ? colores.error : colores.texto)}
      {fila('Pago', NOMBRE_PAGO[turno.estadoPago], color)}
      {turno.fijo &&
        fila(
          'Turno fijo',
          turno.fijo.fechaHasta
            ? `Dado de baja (último: ${fechaCorta(turno.fijo.fechaHasta)})`
            : `Todos los ${diaEnPlural(turno.fijo.diaSemana)}`,
        )}

      <CuentaTurno
        turno={turno}
        onCambio={setTurno}
        onCobrar={() => navigation.navigate('Cobrar', { turnoId: turno.id })}
        onAgregarExtra={() => navigation.navigate('AgregarExtra', { turnoId: turno.id })}
        onLinkPago={() => navigation.navigate('LinkPago', { turnoId: turno.id })}
      />

      <View style={estilos.acciones}>
        {turno.estado === 'confirmado' && (
          <>
            <Boton titulo="Marcar como jugado" variante="secundario" onPress={() => cambiarEstado('jugado')} cargando={guardando} />
            <View style={estilos.espacio} />
            <Boton titulo="Cancelar turno" variante="texto" color={colores.error} onPress={confirmarCancelacion} deshabilitado={guardando} />
          </>
        )}
        {turno.estado === 'jugado' && (
          <Boton titulo="Volver a confirmado" variante="texto" onPress={() => cambiarEstado('confirmado')} cargando={guardando} />
        )}
        {cancelado && turno.fecha >= hoyISO() && (
          <Boton titulo="Reactivar turno" variante="secundario" onPress={() => cambiarEstado('confirmado')} cargando={guardando} />
        )}
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  aviso: { fontSize: 16, fontWeight: '700', marginBottom: espaciado.m },
  tarjeta: {
    padding: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    borderLeftWidth: 5,
    marginBottom: espaciado.l,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: espaciado.m },
  cliente: { flex: 1, marginLeft: espaciado.m },
  nombre: { fontSize: 20, fontWeight: '700' },
  telefono: { fontSize: 15, marginTop: 2 },
  espacio: { height: espaciado.s },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  etiqueta: { fontSize: 15 },
  valor: { fontSize: 16, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: espaciado.m },
  acciones: { marginTop: espaciado.l },
});
