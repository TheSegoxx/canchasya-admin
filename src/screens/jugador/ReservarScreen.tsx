import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ErrorApi } from '../../api/cliente';
import { ComplejoFicha, explorarApi } from '../../api/explorar';
import { Disponibilidad, FormaDePago, reservasApi } from '../../api/reservas';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import type { RutasJugador } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { DIAS_CORTOS, deISO, diaSemana, fechaLarga, hoyISO, sumarDias } from '../../utils/fechas';
import { formatearPesos } from '../../utils/formato';
import { sumarMinutos } from '../../utils/horas';
import {
  duracionesPosibles,
  horariosParaReservar,
  montoSena,
  precioReserva,
  textoDuracion,
  textoPlazoCancelacion,
} from '../../utils/reservas';

type Props = NativeStackScreenProps<RutasJugador, 'Reservar'>;

// "Hoy", "Mañana", "lun 20"
function textoDia(fecha: string, hoy: string): string {
  if (fecha === hoy) {
    return 'Hoy';
  }
  if (fecha === sumarDias(hoy, 1)) {
    return 'Mañana';
  }
  return `${DIAS_CORTOS[diaSemana(fecha) - 1]} ${deISO(fecha).getDate()}`;
}

// Reservar: el día, la cancha, cuánto juegan y la hora. Con el precio y la seña antes de confirmar.
export function ReservarScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const { usuario, actualizarUsuario } = useSesion();
  const { complejoId } = route.params;
  const hoy = hoyISO();
  const [complejo, setComplejo] = useState<ComplejoFicha | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [dia, setDia] = useState<Disponibilidad | null>(null);
  const [errorDia, setErrorDia] = useState('');
  const [canchaId, setCanchaId] = useState<number | null>(route.params.canchaId ?? null);
  const [duracion, setDuracion] = useState<number | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [pago, setPago] = useState<FormaDePago | null>(null);
  const [telefono, setTelefono] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargarComplejo = useCallback(async () => {
    setErrorCarga('');
    try {
      const { complejo: ficha } = await explorarApi.ficha(complejoId);
      setComplejo(ficha);
      // Si no vino una cancha elegida: la primera del deporte que juega (o la primera)
      setCanchaId(
        actual =>
          actual ??
          (ficha.canchas.find(c => usuario?.deportes.includes(c.deporte)) ?? ficha.canchas[0])?.id ??
          null,
      );
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    }
  }, [complejoId, usuario?.deportes]);

  const cargarDia = useCallback(async () => {
    setErrorDia('');
    setDia(null);
    try {
      setDia(await reservasApi.disponibilidad(complejoId, fecha));
    } catch (e) {
      setErrorDia(mensajeDeError(e));
    }
  }, [complejoId, fecha]);

  useEffect(() => {
    cargarComplejo();
  }, [cargarComplejo]);

  useEffect(() => {
    cargarDia();
  }, [cargarDia]);

  useEffect(() => {
    navigation.setOptions({ title: complejo ? `Reservar en ${complejo.nombre}` : 'Reservar' });
  }, [navigation, complejo]);

  const cancha = complejo?.canchas.find(c => c.id === canchaId) ?? null;
  // Al cambiar de cancha, se arranca por lo que dura su turno
  useEffect(() => {
    setDuracion(cancha?.duracionMin ?? null);
  }, [cancha?.id, cancha?.duracionMin]);

  const libres = useMemo(
    () => (cancha && duracion && dia ? horariosParaReservar(cancha.id, duracion, dia) : []),
    [cancha, duracion, dia],
  );
  // Si la hora elegida dejó de estar libre (otro día, otra cancha u otra duración), se suelta
  useEffect(() => {
    if (hora && !libres.includes(hora)) {
      setHora(null);
    }
  }, [hora, libres]);

  if (!complejo) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={cargarComplejo} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const reglas = dia?.reservas ?? complejo.reservas;
  const dias = Array.from({ length: reglas.reservaDias + 1 }, (_, i) => sumarDias(hoy, i));
  const fin = hora && duracion ? sumarMinutos(hora, duracion) : null;
  const precio = cancha && hora && fin ? precioReserva(cancha, hora, fin) : null;
  const sena = precio !== null ? montoSena(precio, reglas.senaPorcentaje) : null;
  const pideSena = reglas.senaPorcentaje > 0;
  // Por defecto, la seña (si la pide) o pagar en el complejo
  const formaDePago: FormaDePago = pago ?? (pideSena ? 'sena' : 'complejo');
  const sinTelefono = !usuario?.telefono;

  const reservar = async () => {
    if (!cancha || !hora || !duracion || enviando) {
      return;
    }
    if (sinTelefono && telefono.replace(/\D/g, '').length < 8) {
      Alert.alert('Falta tu celular', 'Escribí tu celular con el código de área: el complejo te puede escribir por la reserva.');
      return;
    }
    setEnviando(true);
    try {
      const respuesta = await reservasApi.crear({
        canchaId: cancha.id,
        fecha,
        horaInicio: hora,
        duracionMin: duracion,
        pago: formaDePago,
        ...(sinTelefono ? { telefono } : {}),
      });
      if (sinTelefono && usuario) {
        actualizarUsuario({ ...usuario, telefono: telefono.replace(/\D/g, '') });
      }
      navigation.replace('Reserva', { id: respuesta.reserva.id, nueva: true });
      if (respuesta.link) {
        Linking.openURL(respuesta.link.url).catch(() =>
          Alert.alert('Mercado Pago', 'No se pudo abrir Mercado Pago. Probá pagar desde la reserva.'),
        );
      } else if (respuesta.aviso) {
        Alert.alert('Reserva hecha', respuesta.aviso);
      }
    } catch (e) {
      // Alguien la tomó mientras tanto: se vuelven a traer los horarios libres
      if (e instanceof ErrorApi && e.status === 409) {
        cargarDia();
      }
      Alert.alert('No se pudo reservar', mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  if (!reglas.aceptaReservas) {
    return (
      <Pantalla>
        <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>
          {complejo.nombre} no toma reservas por la app en este momento. Escribiles o llamalos para reservar.
        </Text>
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <Text style={[estilos.seccion, { color: colores.texto }]}>¿Qué día?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.dias}>
        {dias.map(d => (
          <Chip key={d} texto={textoDia(d, hoy)} seleccionado={d === fecha} onPress={() => setFecha(d)} />
        ))}
      </ScrollView>

      <Text style={[estilos.seccion, { color: colores.texto }]}>Cancha</Text>
      <View style={estilos.chips}>
        {complejo.canchas.map(c => (
          <Chip key={c.id} texto={c.nombre} seleccionado={c.id === canchaId} onPress={() => setCanchaId(c.id)} />
        ))}
      </View>

      {cancha && (
        <>
          <Text style={[estilos.seccion, { color: colores.texto }]}>¿Cuánto juegan?</Text>
          <View style={estilos.chips}>
            {duracionesPosibles(cancha.duracionMin).map(m => (
              <Chip key={m} texto={textoDuracion(m)} seleccionado={m === duracion} onPress={() => setDuracion(m)} />
            ))}
          </View>
        </>
      )}

      <Text style={[estilos.seccion, { color: colores.texto }]}>¿A qué hora?</Text>
      {errorDia ? (
        <ErrorCarga mensaje={errorDia} onReintentar={cargarDia} />
      ) : !dia ? (
        <ActivityIndicator style={estilos.cargandoDia} color={colores.primario} />
      ) : libres.length === 0 ? (
        <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
          No quedan horarios para jugar {duracion ? textoDuracion(duracion) : ''} este día en {cancha?.nombre}. Probá otro
          día, otra cancha o menos tiempo.
        </Text>
      ) : (
        <View style={estilos.chips}>
          {libres.map(h => (
            <Chip key={h} texto={h} seleccionado={h === hora} onPress={() => setHora(h)} />
          ))}
        </View>
      )}

      {cancha && hora && fin && precio !== null && duracion && (
        <>
          <View style={[estilos.resumen, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
            <Text style={[estilos.resumenTitulo, { color: colores.texto }]}>
              {cancha.nombre} · {fechaLarga(fecha)}
            </Text>
            <Text style={[estilos.resumenDetalle, { color: colores.textoSecundario }]}>
              De {hora} a {fin === '24:00' ? '00:00' : fin} ({textoDuracion(duracion)})
            </Text>
            <View style={[estilos.filaTotal, { borderTopColor: colores.borde }]}>
              <Text style={[estilos.textoTotal, { color: colores.texto }]}>Total</Text>
              <Text style={[estilos.montoTotal, { color: colores.primario }]}>{formatearPesos(precio)}</Text>
            </View>
            {sena !== null && (
              <Text style={[estilos.resumenDetalle, { color: colores.texto }]}>
                Seña para confirmar: <Text style={estilos.negrita}>{formatearPesos(sena)}</Text> ({reglas.senaPorcentaje} %).
                Tenés {textoDuracion(reglas.senaMinutos)} para pagarla; si no, el horario se libera.
              </Text>
            )}
            <Text style={[estilos.resumenDetalle, { color: colores.textoSecundario }]}>
              Podés cancelar sin cargo {textoPlazoCancelacion(reglas.cancelacionHoras)}.
            </Text>
          </View>

          <Text style={[estilos.seccion, { color: colores.texto }]}>¿Cómo pagás?</Text>
          {pideSena && sena !== null ? (
            <>
              <OpcionPago
                titulo={`Pagar la seña: ${formatearPesos(sena)}`}
                detalle={`Con Mercado Pago. El resto (${formatearPesos(precio - sena)}) lo pagás en el complejo.`}
                elegida={formaDePago === 'sena'}
                onPress={() => setPago('sena')}
              />
              <OpcionPago
                titulo={`Pagar todo: ${formatearPesos(precio)}`}
                detalle="Con Mercado Pago, y no pagás nada en el complejo."
                elegida={formaDePago === 'total'}
                onPress={() => setPago('total')}
              />
            </>
          ) : (
            <>
              <OpcionPago
                titulo="Pagar en el complejo"
                detalle="Reservás ahora y pagás cuando vas a jugar."
                elegida={formaDePago === 'complejo'}
                onPress={() => setPago('complejo')}
              />
              <OpcionPago
                titulo={`Pagar ahora: ${formatearPesos(precio)}`}
                detalle="Con Mercado Pago."
                elegida={formaDePago === 'total'}
                onPress={() => setPago('total')}
              />
            </>
          )}

          {sinTelefono && (
            <CampoTexto
              etiqueta="Tu celular (para que el complejo te pueda escribir)"
              value={telefono}
              onChangeText={setTelefono}
              placeholder="Ej.: 11 5555 1234"
              keyboardType="phone-pad"
            />
          )}

          <Boton
            titulo={formaDePago === 'complejo' ? 'Reservar' : 'Reservar e ir a pagar'}
            onPress={reservar}
            cargando={enviando}
          />
        </>
      )}
    </Pantalla>
  );
}

// Una forma de pago para elegir (como un botón de opción)
function OpcionPago({ titulo, detalle, elegida, onPress }: { titulo: string; detalle: string; elegida: boolean; onPress: () => void }) {
  const { colores } = useTema();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: elegida }}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.opcion,
        {
          backgroundColor: elegida ? colores.primario + '14' : colores.superficie,
          borderColor: elegida ? colores.primario : colores.borde,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <View style={[estilos.radio, { borderColor: elegida ? colores.primario : colores.inactivo }]}>
        {elegida && <View style={[estilos.punto, { backgroundColor: colores.primario }]} />}
      </View>
      <View style={estilos.textosOpcion}>
        <Text style={[estilos.tituloOpcion, { color: colores.texto }]}>{titulo}</Text>
        <Text style={[estilos.detalleOpcion, { color: colores.textoSecundario }]}>{detalle}</Text>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cargandoDia: { marginVertical: espaciado.m },
  seccion: { fontSize: 16, fontWeight: '700', marginBottom: espaciado.s, marginTop: espaciado.s },
  dias: { paddingBottom: espaciado.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  ayuda: { fontSize: 14, lineHeight: 20, marginBottom: espaciado.m },
  vacio: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: espaciado.l },
  resumen: { borderWidth: 1, borderRadius: radio, padding: espaciado.m, marginTop: espaciado.m, marginBottom: espaciado.s },
  resumenTitulo: { fontSize: 16, fontWeight: '700' },
  resumenDetalle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  filaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: espaciado.s,
    paddingTop: espaciado.s,
  },
  textoTotal: { fontSize: 16, fontWeight: '600' },
  montoTotal: { fontSize: 20, fontWeight: '700' },
  negrita: { fontWeight: '700' },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radio,
    padding: espaciado.m,
    marginBottom: espaciado.s,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  punto: { width: 10, height: 10, borderRadius: 5 },
  textosOpcion: { flex: 1, marginLeft: espaciado.m },
  tituloOpcion: { fontSize: 15, fontWeight: '600' },
  detalleOpcion: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
