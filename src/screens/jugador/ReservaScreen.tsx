import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NOMBRE_DEPORTE } from '../../api/canchas';
import { Reserva, reservasApi } from '../../api/reservas';
import { Boton } from '../../components/Boton';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Icono } from '../../components/Icono';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasJugador } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { abrirMapa, abrirWhatsApp, llamar } from '../../utils/acciones';
import { fechaRelativa } from '../../utils/fechas';
import { formatearPesos } from '../../utils/formato';
import { estadoReserva, textoDuracion, textoPlazoCancelacion } from '../../utils/reservas';
import { colorDeTono } from './TarjetaReserva';

type Props = NativeStackScreenProps<RutasJugador, 'Reserva'>;

const cifras = (telefono: string) => telefono.replace(/\D/g, '');

// Una reserva del jugador: cómo está, cuánto falta pagar, cómo llegar, pagar por Mercado Pago o cancelar
export function ReservaScreen({ route }: Props) {
  const { colores } = useTema();
  const { id, nueva } = route.params;
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [pagando, setPagando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  // Al volver de Mercado Pago se consulta si entró el pago
  const fueAPagar = useRef(false);

  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      setReserva((await reservasApi.obtener(id)).reserva);
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    }
  }, [id]);

  const verificar = useCallback(
    async (avisarSiNoEntro: boolean) => {
      setVerificando(true);
      try {
        const respuesta = await reservasApi.verificarPago(id);
        setReserva(respuesta.reserva);
        if (respuesta.pagado) {
          Alert.alert('¡Pago recibido!', 'Ya está registrado en tu reserva. ¡Que lo disfruten!');
        } else if (avisarSiNoEntro) {
          Alert.alert('Todavía no figura el pago', 'Si recién pagaste, esperá un momento y volvé a verificar.');
        }
      } catch (e) {
        if (avisarSiNoEntro) {
          Alert.alert('No se pudo verificar', mensajeDeError(e));
        }
      } finally {
        setVerificando(false);
      }
    },
    [id],
  );

  useEffect(() => {
    cargar();
    // Recién creada con pago por Mercado Pago: la app ya abrió el link
    fueAPagar.current = !!nueva;
  }, [cargar, nueva]);

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', estado => {
      if (estado === 'active' && fueAPagar.current) {
        fueAPagar.current = false;
        verificar(false);
      }
    });
    return () => suscripcion.remove();
  }, [verificar]);

  if (!reserva) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const estado = estadoReserva(reserva);
  const color = colorDeTono(estado.tono, colores);
  const activa = reserva.estado === 'confirmado' && !reserva.terminada;
  const telefono = reserva.complejo.telefono ? cifras(reserva.complejo.telefono) : null;
  const faltaSena = reserva.sena !== null ? reserva.sena - reserva.pagado : 0;

  const pagar = async (que: 'sena' | 'saldo') => {
    setPagando(true);
    try {
      const respuesta = await reservasApi.pagar(reserva.id, que);
      setReserva(respuesta.reserva);
      fueAPagar.current = true;
      await Linking.openURL(respuesta.link.url);
    } catch (e) {
      fueAPagar.current = false;
      Alert.alert('No se pudo abrir el pago', mensajeDeError(e));
    } finally {
      setPagando(false);
    }
  };

  const confirmarCancelacion = () => {
    const devolucion = reserva.pagado > 0 ? `\n\nLe avisamos al complejo para que te devuelva ${formatearPesos(reserva.pagado)}.` : '';
    Alert.alert('Cancelar reserva', `${reserva.cancha.nombre}, ${fechaRelativa(reserva.fecha).toLowerCase()} a las ${reserva.horaInicio}.${devolucion}`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar reserva',
        style: 'destructive',
        onPress: async () => {
          setCancelando(true);
          try {
            const respuesta = await reservasApi.cancelar(reserva.id);
            setReserva(respuesta.reserva);
            Alert.alert('Reserva cancelada', respuesta.aviso ?? 'El horario quedó libre para otros jugadores.');
          } catch (e) {
            Alert.alert('No se pudo cancelar', mensajeDeError(e));
          } finally {
            setCancelando(false);
          }
        },
      },
    ]);
  };

  const fila = (etiqueta: string, valor: string, colorValor = colores.texto) => (
    <View style={[estilos.fila, { borderBottomColor: colores.borde }]}>
      <Text style={[estilos.etiqueta, { color: colores.textoSecundario }]}>{etiqueta}</Text>
      <Text style={[estilos.valor, { color: colorValor }]}>{valor}</Text>
    </View>
  );

  return (
    <Pantalla>
      <View style={[estilos.estado, { backgroundColor: color + '1A', borderColor: color + '66' }]}>
        <Text style={[estilos.textoEstado, { color }]}>{estado.texto}</Text>
        {reserva.senaPendiente && (
          <Text style={[estilos.detalleEstado, { color: colores.texto }]}>
            Guardamos el horario hasta las {reserva.senaVenceEn?.slice(11)}. Pagá la seña de {formatearPesos(faltaSena)} para
            confirmarla; si no, se libera para otros jugadores.
          </Text>
        )}
        {nueva && !reserva.senaPendiente && activa && (
          <Text style={[estilos.detalleEstado, { color: colores.texto }]}>¡Listo! Tu cancha está reservada.</Text>
        )}
      </View>

      <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        <Text style={[estilos.complejo, { color: colores.texto }]}>{reserva.complejo.nombre}</Text>
        <Text style={[estilos.direccion, { color: colores.textoSecundario }]}>
          {[reserva.complejo.direccion, reserva.complejo.ciudad].filter(Boolean).join(', ')}
        </Text>
        <View style={estilos.cancha}>
          <Icono nombre={reserva.cancha.deporte} color={colores.primario} tamano={22} />
          <Text style={[estilos.textoCancha, { color: colores.texto }]}>
            {/* "Fútbol 5 · Fútbol 5" no: el deporte solo si el nombre no lo dice */}
            {reserva.cancha.nombre.includes(NOMBRE_DEPORTE[reserva.cancha.deporte])
              ? reserva.cancha.nombre
              : `${reserva.cancha.nombre} · ${NOMBRE_DEPORTE[reserva.cancha.deporte]}`}
          </Text>
        </View>
      </View>

      {fila('Día', fechaRelativa(reserva.fecha))}
      {fila('Horario', `${reserva.horaInicio} a ${reserva.horaFin === '24:00' ? '00:00' : reserva.horaFin} (${textoDuracion(reserva.duracionMin)})`)}
      {fila('Total', formatearPesos(reserva.total))}
      {reserva.sena !== null && fila('Seña', formatearPesos(reserva.sena))}
      {fila('Pagado', formatearPesos(reserva.pagado), reserva.pagado > 0 ? colores.primario : colores.texto)}
      {reserva.estado !== 'cancelado' && fila('Falta pagar', formatearPesos(reserva.saldo), reserva.saldo > 0 ? colores.texto : colores.primario)}

      <View style={estilos.acciones}>
        {activa && reserva.senaPendiente && (
          <>
            <Boton titulo={`Pagar la seña: ${formatearPesos(faltaSena)}`} onPress={() => pagar('sena')} cargando={pagando} />
            <View style={estilos.espacio} />
          </>
        )}
        {activa && reserva.saldo > 0 && (
          <>
            <Boton
              titulo={reserva.senaPendiente ? `Pagar todo: ${formatearPesos(reserva.saldo)}` : `Pagar lo que falta: ${formatearPesos(reserva.saldo)}`}
              variante="secundario"
              onPress={() => pagar('saldo')}
              deshabilitado={pagando}
            />
            <View style={estilos.espacio} />
          </>
        )}
        {reserva.linkPago && (
          <Boton titulo="Ya pagué: verificar el pago" variante="texto" onPress={() => verificar(true)} cargando={verificando} />
        )}

        <Text style={[estilos.seccion, { color: colores.texto }]}>El complejo</Text>
        <Boton
          titulo="Cómo llegar"
          icono="ubicacion"
          variante="secundario"
          onPress={() =>
            reserva.complejo.ubicacion
              ? abrirMapa(reserva.complejo.ubicacion)
              : Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    [reserva.complejo.direccion, reserva.complejo.ciudad].filter(Boolean).join(', '),
                  )}`,
                )
          }
        />
        {telefono && (
          <View style={estilos.contacto}>
            <View style={estilos.boton}>
              <Boton
                titulo="WhatsApp"
                icono="whatsapp"
                variante="secundario"
                onPress={() =>
                  abrirWhatsApp(
                    telefono,
                    `¡Hola! Tengo una reserva en ${reserva.cancha.nombre} para ${fechaRelativa(reserva.fecha).toLowerCase()} a las ${reserva.horaInicio}.`,
                  )
                }
              />
            </View>
            <View style={estilos.boton}>
              <Boton titulo="Llamar" icono="telefono" variante="secundario" onPress={() => llamar(telefono)} />
            </View>
          </View>
        )}

        {reserva.puedeCancelar ? (
          <Boton titulo="Cancelar reserva" variante="texto" color={colores.error} onPress={confirmarCancelacion} cargando={cancelando} />
        ) : (
          activa && (
            <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
              Este complejo permite cancelar {textoPlazoCancelacion(reserva.cancelacionHoras)}. Para cambiar algo, escribiles.
            </Text>
          )
        )}
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  estado: { borderWidth: 1, borderRadius: radio, padding: espaciado.m, marginBottom: espaciado.m },
  textoEstado: { fontSize: 16, fontWeight: '700' },
  detalleEstado: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  tarjeta: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radio, padding: espaciado.m, marginBottom: espaciado.m },
  complejo: { fontSize: 20, fontWeight: '700' },
  direccion: { fontSize: 14, marginTop: 2 },
  cancha: { flexDirection: 'row', alignItems: 'center', marginTop: espaciado.s },
  textoCancha: { fontSize: 15, fontWeight: '600', marginLeft: espaciado.s },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  etiqueta: { fontSize: 15 },
  valor: { fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: espaciado.m },
  acciones: { marginTop: espaciado.l },
  espacio: { height: espaciado.s },
  seccion: { fontSize: 16, fontWeight: '700', marginTop: espaciado.l, marginBottom: espaciado.s },
  contacto: { flexDirection: 'row', marginTop: espaciado.s, marginHorizontal: -4, marginBottom: espaciado.m },
  boton: { flex: 1, marginHorizontal: 4 },
  ayuda: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: espaciado.m },
});
