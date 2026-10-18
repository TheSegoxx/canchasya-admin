import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ParteVaquita, Reserva, reservasApi } from '../../api/reservas';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Icono } from '../../components/Icono';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import type { RutasJugador } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { compartirPorWhatsApp } from '../../utils/acciones';
import { formatearPesos } from '../../utils/formato';
import {
  avance,
  dividirVaquita,
  MAXIMO_PARTES,
  mensajeGrupo,
  mensajeParte,
  MINIMO_PARTES,
  personasPorDeporte,
} from '../../utils/vaquita';

type Props = NativeStackScreenProps<RutasJugador, 'Vaquita'>;

// La vaquita: dividir lo que falta pagar entre los amigos, mandarle a cada uno su link y ver quién pagó
export function VaquitaScreen({ route }: Props) {
  const { colores } = useTema();
  const { usuario } = useSesion();
  const { id } = route.params;
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [personas, setPersonas] = useState<number | null>(null);
  const [nombres, setNombres] = useState<string[]>([]);
  const [armando, setArmando] = useState(false);
  const [deshaciendo, setDeshaciendo] = useState(false);
  const fueAPagar = useRef(false);

  // Primero trae la reserva; después pregunta si entraron pagos (puede tardar por Mercado Pago)
  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      setReserva((await reservasApi.obtener(id)).reserva);
      setReserva((await reservasApi.verificarPago(id)).reserva);
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  // Al volver de pagar la parte propia en Mercado Pago
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', estado => {
      if (estado === 'active' && fueAPagar.current) {
        fueAPagar.current = false;
        cargar();
      }
    });
    return () => suscripcion.remove();
  }, [cargar]);

  if (!reserva) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const cantidad = personas ?? personasPorDeporte(reserva.cancha.deporte);
  const activa = reserva.estado === 'confirmado' && !reserva.terminada;
  const puedeArmar = activa && !reserva.vaquitaEnMarcha && reserva.saldo >= cantidad;
  const montos = dividirVaquita(reserva.saldo, cantidad);
  const progreso = avance(reserva.vaquita);
  const nombrePropio = usuario?.nombre.split(' ')[0] ?? 'Vos';

  const cambiarCantidad = (n: number) => {
    setPersonas(Math.min(MAXIMO_PARTES, Math.max(MINIMO_PARTES, n)));
  };

  const armar = async () => {
    setArmando(true);
    try {
      const lista = Array.from({ length: cantidad }, (_, i) => (i === 0 ? '' : (nombres[i] ?? '').trim()));
      setReserva((await reservasApi.armarVaquita(reserva.id, lista)).reserva);
      setNombres([]);
    } catch (e) {
      Alert.alert('No se pudo armar la vaquita', mensajeDeError(e));
    } finally {
      setArmando(false);
    }
  };

  const confirmarDeshacer = () =>
    Alert.alert(
      'Deshacer la vaquita',
      'Los links que no se pagaron dejan de funcionar. Lo que ya pagaron queda en la reserva.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Deshacer',
          style: 'destructive',
          onPress: async () => {
            setDeshaciendo(true);
            try {
              setReserva((await reservasApi.deshacerVaquita(reserva.id)).reserva);
            } catch (e) {
              Alert.alert('No se pudo deshacer', mensajeDeError(e));
            } finally {
              setDeshaciendo(false);
            }
          },
        },
      ],
    );

  const pagarMiParte = async (parte: ParteVaquita) => {
    if (!parte.url) {
      return;
    }
    fueAPagar.current = true;
    try {
      await Linking.openURL(parte.url);
    } catch {
      fueAPagar.current = false;
      Alert.alert('Mercado Pago', 'No se pudo abrir el link de pago.');
    }
  };

  return (
    <Pantalla>
      {reserva.vaquita.length > 0 && (
        <>
          <View style={[estilos.resumen, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
            <Text style={[estilos.juntado, { color: colores.texto }]}>
              Juntaron {formatearPesos(progreso.juntado)}{' '}
              <Text style={{ color: colores.textoSecundario }}>de {formatearPesos(progreso.total)}</Text>
            </Text>
            <View style={[estilos.barra, { backgroundColor: colores.borde }]}>
              <View
                style={[
                  estilos.relleno,
                  { backgroundColor: colores.primario, width: `${progreso.total > 0 ? (progreso.juntado / progreso.total) * 100 : 0}%` },
                ]}
              />
            </View>
            <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
              Pagaron {progreso.pagaron} de {reserva.vaquita.length}
              {reserva.saldo > 0 ? ` · Falta pagar ${formatearPesos(reserva.saldo)} de la reserva` : ' · ¡La reserva está pagada!'}
            </Text>
          </View>

          {reserva.senaPendiente && reserva.senaVenceEn && (
            <Text style={[estilos.aviso, { color: colores.senado }]}>
              Tienen hasta las {reserva.senaVenceEn.slice(11)} para juntar la seña ({formatearPesos(reserva.sena ?? 0)}); si no,
              la reserva se cancela.
            </Text>
          )}

          {reserva.vaquitaEnMarcha && (
            <Boton titulo="Mandar todo al grupo de WhatsApp" icono="whatsapp" color={colores.whatsapp} onPress={() => compartirPorWhatsApp(mensajeGrupo(reserva, reserva.vaquita))} />
          )}

          <View style={estilos.lista}>
            {reserva.vaquita.map(parte => (
              <FilaParte
                key={parte.id}
                parte={parte}
                onPagar={() => pagarMiParte(parte)}
                onWhatsApp={() => compartirPorWhatsApp(mensajeParte(reserva, parte))}
                onCompartir={() => Share.share({ message: mensajeParte(reserva, parte) })}
              />
            ))}
          </View>

          {reserva.vaquitaEnMarcha && (
            <Boton titulo="Deshacer la vaquita" variante="texto" color={colores.error} onPress={confirmarDeshacer} cargando={deshaciendo} />
          )}
        </>
      )}

      {puedeArmar && (
        <>
          <Text style={[estilos.titulo, { color: colores.texto }]}>
            {reserva.vaquita.length > 0 ? 'Dividir lo que falta' : 'Dividí la cancha con tus amigos'}
          </Text>
          <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
            Cada uno recibe su link de Mercado Pago y lo que pagan se suma solo a la reserva. Falta pagar{' '}
            {formatearPesos(reserva.saldo)}.
          </Text>

          <View style={[estilos.contador, { borderColor: colores.borde, backgroundColor: colores.superficie }]}>
            <BotonContador icono="anterior" etiqueta="Uno menos" deshabilitado={cantidad <= MINIMO_PARTES} onPress={() => cambiarCantidad(cantidad - 1)} />
            <View style={estilos.centroContador}>
              <Text style={[estilos.cantidad, { color: colores.texto }]}>{cantidad} personas</Text>
              <Text style={[estilos.cadaUno, { color: colores.primario }]}>{formatearPesos(montos[1])} cada uno</Text>
            </View>
            <BotonContador icono="siguiente" etiqueta="Uno más" deshabilitado={cantidad >= MAXIMO_PARTES} onPress={() => cambiarCantidad(cantidad + 1)} />
          </View>
          {montos[0] !== montos[1] && (
            <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
              Vos ponés {formatearPesos(montos[0])} para que cierre justo.
            </Text>
          )}

          <Text style={[estilos.subtitulo, { color: colores.texto }]}>¿Quiénes juegan? (opcional)</Text>
          <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
            Con los nombres sabés quién ya pagó.
          </Text>
          <CampoTexto etiqueta="1. Vos" value={nombrePropio} editable={false} />
          {Array.from({ length: cantidad - 1 }, (_, i) => i + 1).map(i => (
            <CampoTexto
              key={i}
              etiqueta={`${i + 1}.`}
              value={nombres[i] ?? ''}
              onChangeText={texto => {
                const copia = [...nombres];
                copia[i] = texto;
                setNombres(copia);
              }}
              placeholder={`Amigo ${i + 1}`}
              maxLength={40}
              autoCapitalize="words"
            />
          ))}
          <Boton titulo="Armar la vaquita" icono="clientes" onPress={armar} cargando={armando} />
        </>
      )}

      {!puedeArmar && reserva.vaquita.length === 0 && (
        <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
          {reserva.saldo <= 0 ? 'Esta reserva ya está pagada: no hay nada que dividir.' : 'Esta reserva ya no se puede dividir.'}
        </Text>
      )}
    </Pantalla>
  );
}

function BotonContador({ icono, etiqueta, deshabilitado, onPress }: { icono: 'anterior' | 'siguiente'; etiqueta: string; deshabilitado: boolean; onPress: () => void }) {
  const { colores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [estilos.botonContador, { borderColor: colores.borde, opacity: deshabilitado ? 0.35 : pressed ? 0.6 : 1 }]}>
      <Text style={[estilos.signo, { color: colores.primario }]}>{icono === 'anterior' ? '−' : '+'}</Text>
    </Pressable>
  );
}

// Un amigo: cuánto pone, si ya pagó y cómo mandarle su link
function FilaParte({
  parte,
  onPagar,
  onWhatsApp,
  onCompartir,
}: {
  parte: ParteVaquita;
  onPagar: () => void;
  onWhatsApp: () => void;
  onCompartir: () => void;
}) {
  const { colores } = useTema();
  const estado = {
    pagada: { texto: 'Pagó ✓', color: colores.primario },
    pendiente: { texto: 'Falta pagar', color: colores.senado },
    vencida: { texto: 'Link vencido', color: colores.textoSecundario },
  }[parte.estado];
  return (
    <View style={[estilos.parte, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      <View style={estilos.filaParte}>
        <View style={[estilos.inicial, { backgroundColor: estado.color + '22' }]}>
          <Text style={[estilos.letra, { color: estado.color }]}>{parte.nombre.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={estilos.datosParte}>
          <Text style={[estilos.nombre, { color: colores.texto }]} numberOfLines={1}>
            {parte.esOrganizador ? `${parte.nombre} (vos)` : parte.nombre}
          </Text>
          <Text style={[estilos.estado, { color: estado.color }]}>{estado.texto}</Text>
        </View>
        <Text style={[estilos.monto, { color: colores.texto }]}>{formatearPesos(parte.monto)}</Text>
      </View>
      {parte.estado === 'pendiente' &&
        (parte.esOrganizador ? (
          <View style={estilos.accionesParte}>
            <Boton titulo="Pagar mi parte" variante="secundario" onPress={onPagar} />
          </View>
        ) : (
          <View style={[estilos.accionesParte, estilos.fila]}>
            <View style={estilos.mitad}>
              <Boton titulo="WhatsApp" icono="whatsapp" variante="secundario" onPress={onWhatsApp} />
            </View>
            <View style={estilos.mitad}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Compartir el link de ${parte.nombre}`}
                onPress={onCompartir}
                style={({ pressed }) => [estilos.compartir, { borderColor: colores.borde, opacity: pressed ? 0.6 : 1 }]}>
                <Icono nombre="mas" color={colores.texto} tamano={18} />
                <Text style={[estilos.textoCompartir, { color: colores.texto }]}>Otra app</Text>
              </Pressable>
            </View>
          </View>
        ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resumen: { borderWidth: 1, borderRadius: radio, padding: espaciado.m, marginBottom: espaciado.m },
  juntado: { fontSize: 20, fontWeight: '700' },
  barra: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: espaciado.s },
  relleno: { height: 8, borderRadius: 4 },
  detalle: { fontSize: 14, lineHeight: 20, marginBottom: espaciado.s },
  aviso: { fontSize: 14, lineHeight: 20, fontWeight: '600', marginBottom: espaciado.m },
  lista: { marginTop: espaciado.m },
  titulo: { fontSize: 20, fontWeight: '700', marginTop: espaciado.m, marginBottom: espaciado.xs },
  subtitulo: { fontSize: 16, fontWeight: '700', marginTop: espaciado.m },
  contador: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radio,
    padding: espaciado.s,
    marginVertical: espaciado.s,
  },
  botonContador: { width: 48, height: 48, borderRadius: radio - 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  signo: { fontSize: 26, fontWeight: '600', lineHeight: 30 },
  centroContador: { flex: 1, alignItems: 'center' },
  cantidad: { fontSize: 18, fontWeight: '700' },
  cadaUno: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  parte: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radio, padding: espaciado.m, marginBottom: espaciado.s },
  filaParte: { flexDirection: 'row', alignItems: 'center' },
  inicial: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  letra: { fontSize: 17, fontWeight: '700' },
  datosParte: { flex: 1, marginHorizontal: espaciado.m },
  nombre: { fontSize: 16, fontWeight: '600' },
  estado: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  monto: { fontSize: 16, fontWeight: '700' },
  accionesParte: { marginTop: espaciado.s },
  fila: { flexDirection: 'row', marginHorizontal: -4 },
  mitad: { flex: 1, marginHorizontal: 4 },
  compartir: {
    minHeight: 48,
    borderRadius: radio,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCompartir: { fontSize: 15, fontWeight: '600', marginLeft: espaciado.s },
});
