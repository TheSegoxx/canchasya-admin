import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Caja, cobrosApi, NOMBRE_METODO } from '../../api/cobros';
import { ErrorCarga } from '../../components/ErrorCarga';
import { SelectorDia } from '../../components/SelectorDia';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { fechaCorta, hoyISO } from '../../utils/fechas';
import { formatearPesos } from '../../utils/formato';

// Caja del día: lo que entró (efectivo y transferencia) y lo que falta cobrar de los turnos del día
export function CajaScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const [fecha, setFecha] = useState(hoyISO());
  const [caja, setCaja] = useState<Caja | null>(null);
  const [error, setError] = useState<{ fecha: string; mensaje: string } | null>(null);
  const [recargando, setRecargando] = useState(false);
  const pedida = useRef(fecha);

  const cargar = useCallback(async (dia: string) => {
    pedida.current = dia;
    try {
      const datos = await cobrosApi.caja(dia);
      if (pedida.current === dia) {
        setCaja(datos);
        setError(null);
      }
    } catch (e) {
      if (pedida.current === dia) {
        setError({ fecha: dia, mensaje: mensajeDeError(e) });
      }
    } finally {
      setRecargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar(fecha);
    }, [cargar, fecha]),
  );

  const delDia = caja?.fecha === fecha ? caja : null;
  const mensajeError = error?.fecha === fecha ? error.mensaje : '';
  const abrirTurno = (id: number) => navigation.navigate('Turno', { id });

  const tarjeta = (titulo: string, monto: number, color: string, grande = false) => (
    <View
      style={[
        estilos.tarjeta,
        grande ? estilos.tarjetaGrande : estilos.tarjetaChica,
        { backgroundColor: colores.superficie, borderColor: colores.borde },
      ]}>
      <Text style={[estilos.tituloTarjeta, { color: colores.textoSecundario }]}>{titulo}</Text>
      <Text style={[grande ? estilos.montoGrande : estilos.monto, { color }]}>{formatearPesos(monto)}</Text>
    </View>
  );

  let contenido: React.ReactNode;
  if (delDia) {
    contenido = (
      <>
        {tarjeta(`Cobrado · ${delDia.totales.cantidad} ${delDia.totales.cantidad === 1 ? 'cobro' : 'cobros'}`, delDia.totales.total, colores.primario, true)}
        <View style={estilos.fila}>
          {tarjeta('Efectivo', delDia.totales.efectivo, colores.texto)}
          <View style={estilos.separador} />
          {tarjeta('Transferencia', delDia.totales.transferencia, colores.texto)}
        </View>
        {delDia.totales.mercadopago > 0 && tarjeta('Mercado Pago', delDia.totales.mercadopago, colores.texto)}

        <Text style={[estilos.seccion, { color: colores.texto }]}>
          Falta cobrar {delDia.totalPorCobrar > 0 ? `· ${formatearPesos(delDia.totalPorCobrar)}` : ''}
        </Text>
        {delDia.porCobrar.length === 0 ? (
          <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>Nada pendiente en los turnos de este día.</Text>
        ) : (
          delDia.porCobrar.map(t => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityHint="Abre el turno para cobrarlo"
              onPress={() => abrirTurno(t.id)}
              style={({ pressed }) => [
                estilos.item,
                { backgroundColor: colores.superficie, borderColor: colores.borde, borderLeftColor: t.pagado > 0 ? colores.senado : colores.ocupada, opacity: pressed ? 0.85 : 1 },
              ]}>
              <Text style={[estilos.hora, { color: colores.texto }]}>{t.horaInicio}</Text>
              <View style={estilos.datos}>
                <Text numberOfLines={1} style={[estilos.nombre, { color: colores.texto }]}>{t.cliente.nombre}</Text>
                <Text numberOfLines={1} style={[estilos.detalle, { color: colores.textoSecundario }]}>
                  {t.canchaNombre}
                  {t.pagado > 0 ? ` · pagó ${formatearPesos(t.pagado)}` : ''}
                </Text>
              </View>
              <Text style={[estilos.importe, { color: colores.ocupada }]}>{formatearPesos(t.total - t.pagado)}</Text>
            </Pressable>
          ))
        )}

        <Text style={[estilos.seccion, { color: colores.texto }]}>Cobros del día</Text>
        {delDia.cobros.length === 0 ? (
          <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>Todavía no se cobró nada este día.</Text>
        ) : (
          delDia.cobros.map(c => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              onPress={() => abrirTurno(c.turno.id)}
              style={({ pressed }) => [
                estilos.item,
                { backgroundColor: colores.superficie, borderColor: colores.borde, borderLeftColor: colores.pagado, opacity: pressed ? 0.85 : 1 },
              ]}>
              <Text style={[estilos.hora, { color: colores.texto }]}>{c.hora}</Text>
              <View style={estilos.datos}>
                <Text numberOfLines={1} style={[estilos.nombre, { color: colores.texto }]}>{c.turno.cliente}</Text>
                <Text numberOfLines={1} style={[estilos.detalle, { color: colores.textoSecundario }]}>
                  {NOMBRE_METODO[c.metodo]} · turno {c.turno.fecha === fecha ? '' : `${fechaCorta(c.turno.fecha)} `}
                  {c.turno.horaInicio} {c.turno.cancha}
                </Text>
              </View>
              <Text style={[estilos.importe, { color: colores.texto }]}>{formatearPesos(c.monto)}</Text>
            </Pressable>
          ))
        )}
      </>
    );
  } else if (mensajeError) {
    contenido = <ErrorCarga mensaje={mensajeError} onReintentar={() => cargar(fecha)} />;
  } else {
    contenido = <ActivityIndicator style={estilos.cargando} size="large" color={colores.primario} />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
      refreshControl={
        <RefreshControl
          refreshing={recargando}
          onRefresh={() => {
            setRecargando(true);
            cargar(fecha);
          }}
          colors={[colores.primario]}
        />
      }>
      <SelectorDia etiqueta="Día" fecha={fecha} onCambiar={setFecha} />
      {!!mensajeError && delDia && (
        <Text accessibilityLiveRegion="polite" style={[estilos.aviso, { color: colores.error }]}>
          {mensajeError}
        </Text>
      )}
      {contenido}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espaciado.m, paddingBottom: espaciado.xl, flexGrow: 1 },
  cargando: { marginTop: espaciado.xl },
  aviso: { fontSize: 14, marginBottom: espaciado.s },
  fila: { flexDirection: 'row' },
  separador: { width: espaciado.s },
  tarjeta: { borderWidth: 1, borderRadius: radio, padding: espaciado.m, marginBottom: espaciado.s },
  tarjetaGrande: { alignItems: 'center' },
  tarjetaChica: { flex: 1 },
  tituloTarjeta: { fontSize: 14, fontWeight: '600' },
  // Números sueltos grandes: cifras proporcionales
  montoGrande: { fontSize: 34, fontWeight: '800', marginTop: espaciado.xs },
  monto: { fontSize: 20, fontWeight: '700', marginTop: espaciado.xs },
  seccion: { fontSize: 17, fontWeight: '700', marginTop: espaciado.l, marginBottom: espaciado.s },
  vacio: { fontSize: 15 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    borderLeftWidth: 5,
    marginBottom: espaciado.s,
  },
  hora: { width: 52, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  datos: { flex: 1, marginHorizontal: espaciado.s },
  nombre: { fontSize: 16, fontWeight: '700' },
  detalle: { fontSize: 13, marginTop: 2 },
  importe: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
