import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { dashboardApi, nombreCategoria, Resumen } from '../../api/dashboard';
import { Boton } from '../../components/Boton';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Icono } from '../../components/Icono';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { hoyISO } from '../../utils/fechas';
import { formatearPesos } from '../../utils/formato';
import { moverPeriodo, NOMBRE_PERIODO, Periodo, rangoDe, tituloPeriodo } from '../../utils/periodos';
import { BarrasHorizontales } from './BarrasHorizontales';
import { GraficoBalance } from './GraficoBalance';

// Pestaña "Dashboard": ingresos, egresos y balance de una semana, un mes o un año
export function DashboardScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [referencia, setReferencia] = useState(hoyISO());
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<{ clave: string; mensaje: string } | null>(null);
  const [recargando, setRecargando] = useState(false);

  const { desde, hasta } = rangoDe(periodo, referencia);
  const clave = `${desde}/${hasta}`;
  const pedida = useRef(clave);

  const cargar = useCallback(async (d: string, h: string) => {
    const esta = `${d}/${h}`;
    pedida.current = esta;
    try {
      const datos = await dashboardApi.resumen(d, h);
      if (pedida.current === esta) {
        setResumen(datos);
        setError(null);
      }
    } catch (e) {
      if (pedida.current === esta) {
        setError({ clave: esta, mensaje: mensajeDeError(e) });
      }
    } finally {
      setRecargando(false);
    }
  }, []);

  // Al volver de cargar un gasto se actualiza
  useFocusEffect(
    useCallback(() => {
      cargar(desde, hasta);
    }, [cargar, desde, hasta]),
  );

  const delPeriodo = resumen && `${resumen.desde}/${resumen.hasta}` === clave ? resumen : null;
  // Mientras llega el período nuevo se deja el anterior atenuado (sin saltos)
  const mostrado = delPeriodo ?? resumen;
  const mensajeError = error?.clave === clave ? error.mensaje : '';

  const flecha = (direccion: 'anterior' | 'siguiente') => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direccion === 'anterior' ? 'Período anterior' : 'Período siguiente'}
      onPress={() => setReferencia(r => moverPeriodo(periodo, r, direccion === 'anterior' ? -1 : 1))}
      hitSlop={8}
      style={[estilos.flecha, { borderColor: colores.borde }]}>
      <Icono nombre={direccion} color={colores.primario} />
    </Pressable>
  );

  const tarjeta = (titulo: string, contenido: React.ReactNode) => (
    <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      <Text style={[estilos.tituloTarjeta, { color: colores.texto }]}>{titulo}</Text>
      {contenido}
    </View>
  );

  const dato = (titulo: string, monto: number, detalle?: string) => (
    <View style={[estilos.dato, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      <Text style={[estilos.tituloDato, { color: colores.textoSecundario }]}>{titulo}</Text>
      <Text style={[estilos.montoDato, { color: monto < 0 ? colores.error : colores.texto }]}>{formatearPesos(monto)}</Text>
      {!!detalle && <Text style={[estilos.detalleDato, { color: colores.textoSecundario }]}>{detalle}</Text>}
    </View>
  );

  let contenido: React.ReactNode;
  if (mostrado) {
    const r = mostrado;
    const ocupacion = r.turnos.ocupacion;
    contenido = (
      <View style={!delPeriodo && estilos.cargandoOtro}>
        <View style={estilos.balance}>
          <Text style={[estilos.tituloDato, { color: colores.textoSecundario }]}>Balance del período</Text>
          <Text style={[estilos.montoBalance, { color: r.balance < 0 ? colores.error : colores.texto }]}>
            {formatearPesos(r.balance)}
          </Text>
        </View>

        <View style={estilos.fila}>
          {dato('Ingresos', r.ingresos.total, r.ingresos.otros > 0 ? `Turnos ${formatearPesos(r.ingresos.turnos)}` : undefined)}
          <View style={estilos.separador} />
          {dato('Egresos', r.egresos)}
        </View>
        <View style={estilos.fila}>
          {dato('En efectivo', r.billetera.efectivo)}
          <View style={estilos.separador} />
          {dato('En transferencias', r.billetera.transferencia)}
        </View>

        {tarjeta('Ingresos y egresos', <GraficoBalance serie={r.serie} periodo={periodo} />)}

        {r.egresosPorCategoria.length > 0 &&
          tarjeta(
            'Gastos por categoría',
            <BarrasHorizontales
              color={colores.serieEgresos}
              items={r.egresosPorCategoria.map(c => ({ clave: c.categoria, nombre: nombreCategoria('egreso', c.categoria), monto: c.monto }))}
            />,
          )}

        {r.ingresosPorCancha.length > 0 &&
          tarjeta(
            'Cobrado por cancha',
            <BarrasHorizontales
              color={colores.serieIngresos}
              items={r.ingresosPorCancha.map(c => ({ clave: c.canchaId, nombre: c.nombre, monto: c.monto }))}
            />,
          )}

        {tarjeta(
          'Turnos',
          <>
            <Text style={[estilos.texto, { color: colores.texto }]}>
              {r.turnos.reservados} reservados · {r.turnos.cancelados} cancelados
            </Text>
            {ocupacion !== null && (
              <>
                <View style={estilos.filaOcupacion}>
                  <Text style={[estilos.texto, { color: colores.textoSecundario }]}>Ocupación de las canchas</Text>
                  <Text style={[estilos.porcentaje, { color: colores.texto }]}>{Math.round(ocupacion * 100)}%</Text>
                </View>
                <View
                  accessible
                  accessibilityLabel={`Ocupación ${Math.round(ocupacion * 100)} por ciento`}
                  style={[estilos.pista, { backgroundColor: colores.primario + '33' }]}>
                  <View style={[estilos.relleno, { width: `${ocupacion * 100}%`, backgroundColor: colores.primario }]} />
                </View>
                <Text style={[estilos.nota, { color: colores.textoSecundario }]}>
                  Horas reservadas sobre las horas abiertas, hasta hoy.
                </Text>
              </>
            )}
          </>,
        )}

        <Boton
          titulo="Ver gastos e ingresos cargados"
          variante="secundario"
          onPress={() => navigation.navigate('Movimientos', { desde, hasta, titulo: tituloPeriodo(periodo, referencia) })}
        />
      </View>
    );
  } else if (mensajeError) {
    contenido = <ErrorCarga mensaje={mensajeError} onReintentar={() => cargar(desde, hasta)} />;
  } else {
    contenido = <ActivityIndicator style={estilos.cargando} size="large" color={colores.primario} />;
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        refreshControl={
          <RefreshControl
            refreshing={recargando}
            onRefresh={() => {
              setRecargando(true);
              cargar(desde, hasta);
            }}
            colors={[colores.primario]}
          />
        }>
        {/* Un solo filtro arriba de todo: período y navegación */}
        <View style={estilos.chips}>
          {(['semana', 'mes', 'anio'] as Periodo[]).map(p => (
            <Chip key={p} texto={NOMBRE_PERIODO[p]} seleccionado={periodo === p} onPress={() => setPeriodo(p)} />
          ))}
        </View>
        <View style={estilos.navegacion}>
          {flecha('anterior')}
          <Text accessibilityLiveRegion="polite" style={[estilos.titulo, { color: colores.texto }]}>
            {tituloPeriodo(periodo, referencia)}
          </Text>
          {flecha('siguiente')}
        </View>
        {!!mensajeError && mostrado && (
          <Text accessibilityLiveRegion="polite" style={[estilos.aviso, { color: colores.error }]}>
            {mensajeError}
          </Text>
        )}
        {contenido}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cargar un gasto o un ingreso"
        onPress={() => navigation.navigate('Movimiento', {})}
        style={({ pressed }) => [estilos.flotante, { backgroundColor: colores.primario, opacity: pressed ? 0.85 : 1 }]}>
        <Icono nombre="agregar" color={colores.textoSobrePrimario} tamano={28} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: espaciado.m, paddingBottom: 96, flexGrow: 1 },
  cargando: { marginTop: espaciado.xl },
  cargandoOtro: { opacity: 0.5 },
  chips: { flexDirection: 'row' },
  navegacion: { flexDirection: 'row', alignItems: 'center', marginBottom: espaciado.m },
  flecha: { width: 44, height: 44, borderRadius: radio - 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  titulo: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  aviso: { fontSize: 14, marginBottom: espaciado.s },
  balance: { alignItems: 'center', marginBottom: espaciado.m },
  // Número principal: cifras proporcionales (sin tabular-nums)
  montoBalance: { fontSize: 44, fontWeight: '800', marginTop: espaciado.xs },
  fila: { flexDirection: 'row', marginBottom: espaciado.s },
  separador: { width: espaciado.s },
  dato: { flex: 1, borderWidth: 1, borderRadius: radio, padding: espaciado.m },
  tituloDato: { fontSize: 14, fontWeight: '600' },
  montoDato: { fontSize: 20, fontWeight: '700', marginTop: espaciado.xs },
  detalleDato: { fontSize: 12, marginTop: 2 },
  tarjeta: { borderWidth: 1, borderRadius: radio, padding: espaciado.m, marginTop: espaciado.s, marginBottom: espaciado.s },
  tituloTarjeta: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.m },
  texto: { fontSize: 15 },
  filaOcupacion: { flexDirection: 'row', justifyContent: 'space-between', marginTop: espaciado.m, marginBottom: espaciado.xs },
  porcentaje: { fontSize: 15, fontWeight: '700' },
  pista: { height: 10, borderRadius: 5, overflow: 'hidden' },
  relleno: { height: 10, borderRadius: 5 },
  nota: { fontSize: 12, marginTop: espaciado.xs },
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
