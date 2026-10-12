import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { agendaApi, TurnoDetalle } from '../../api/agenda';
import { cobrosApi, LinkPago } from '../../api/cobros';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { abrirWhatsApp } from '../../utils/acciones';
import { DIAS_CORTOS, diaSemana, fechaCorta } from '../../utils/fechas';
import { formatearPesos, leerPesos, pesosParaEditar } from '../../utils/formato';

type Props = NativeStackScreenProps<RutasApp, 'LinkPago'>;

const centavos = (monto: number) => Math.round(monto * 100) / 100;

// Mensaje para el cliente con el link de Mercado Pago
export function mensajeLinkPago(turno: TurnoDetalle, link: LinkPago): string {
  const dia = `${DIAS_CORTOS[diaSemana(turno.fecha) - 1]} ${fechaCorta(turno.fecha)}`;
  return (
    `¡Hola ${turno.cliente.nombre.split(' ')[0]}! Para confirmar tu turno en ${turno.complejo.nombre} ` +
    `(${dia} a las ${turno.horaInicio}, ${turno.cancha.nombre}) podés pagar ${formatearPesos(link.monto)} ` +
    `con Mercado Pago acá:\n${link.url}\nEl link vence en 24 horas.`
  );
}

// Generar un link de Mercado Pago (por ejemplo, para la seña) y mandárselo al cliente
export function LinkPagoScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const { turnoId } = route.params;
  const [turno, setTurno] = useState<TurnoDetalle | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [monto, setMonto] = useState('');
  const [link, setLink] = useState<LinkPago | null>(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      const { turno: datos } = await agendaApi.obtenerTurno(turnoId);
      setTurno(datos);
      // Por defecto, la mitad de lo que falta (la seña habitual)
      setMonto(String(Math.round((datos.total - datos.pagado) / 2)));
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    }
  }, [turnoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!turno) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const saldo = centavos(turno.total - turno.pagado);
  const mitad = Math.round(saldo / 2);
  const importe = leerPesos(monto);

  const crear = async () => {
    if (creando) {
      return;
    }
    if (importe === null || importe <= 0 || importe > saldo) {
      setError(`Escribí un monto entre $ 1 y ${formatearPesos(saldo)}.`);
      return;
    }
    setError('');
    setCreando(true);
    try {
      const respuesta = await cobrosApi.crearLink(turno.id, importe);
      setLink(respuesta.link);
      setTurno(respuesta.turno);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCreando(false);
    }
  };

  if (link) {
    const mensaje = mensajeLinkPago(turno, link);
    return (
      <Pantalla>
        <Text style={[estilos.titulo, { color: colores.primario }]}>✓ Link creado</Text>
        <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
          <Text style={[estilos.monto, { color: colores.texto }]}>{formatearPesos(link.monto)}</Text>
          <Text selectable style={[estilos.url, { color: colores.textoSecundario }]}>
            {link.url}
          </Text>
        </View>
        <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
          Cuando el cliente pague, se suma solo a la cuenta del turno (se verifica al abrir el turno).
        </Text>
        <Boton
          titulo={`Mandárselo a ${turno.cliente.nombre.split(' ')[0]}`}
          icono="whatsapp"
          color={colores.whatsapp}
          onPress={() => abrirWhatsApp(turno.cliente.telefono, mensaje)}
        />
        <View style={estilos.espacio} />
        <Boton titulo="Compartir de otra forma" variante="secundario" onPress={() => Share.share({ message: mensaje })} />
        <Boton titulo="Listo" variante="texto" onPress={() => navigation.goBack()} />
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        Se crea un link de Mercado Pago para que {turno.cliente.nombre} pague desde el celular. Vence en 24 horas.
      </Text>
      <CampoTexto etiqueta="Monto a cobrar ($)" value={monto} onChangeText={setMonto} keyboardType="numeric" />
      <View style={estilos.chips}>
        {mitad < saldo && (
          <Chip texto={`Seña 50%: ${formatearPesos(mitad)}`} seleccionado={importe === mitad} onPress={() => setMonto(String(mitad))} />
        )}
        <Chip texto={`Todo: ${formatearPesos(saldo)}`} seleccionado={importe === saldo} onPress={() => setMonto(pesosParaEditar(saldo))} />
      </View>
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo="Crear link de pago" onPress={crear} cargando={creando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 20, fontWeight: '700', marginBottom: espaciado.m },
  tarjeta: { borderWidth: 1, borderRadius: radio, padding: espaciado.m, marginBottom: espaciado.m },
  monto: { fontSize: 28, fontWeight: '800', marginBottom: espaciado.xs },
  url: { fontSize: 13 },
  ayuda: { fontSize: 15, lineHeight: 21, marginBottom: espaciado.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.s },
  error: { fontSize: 14, marginBottom: espaciado.m },
  espacio: { height: espaciado.s },
});
