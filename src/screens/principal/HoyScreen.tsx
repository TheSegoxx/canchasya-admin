import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Agenda, agendaApi, NOMBRE_PAGO, Turno } from '../../api/agenda';
import { Caja, cobrosApi } from '../../api/cobros';
import { Boton } from '../../components/Boton';
import { ErrorCarga } from '../../components/ErrorCarga';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { turnoActivo } from '../../utils/agenda';
import { fechaLarga, hoyISO } from '../../utils/fechas';
import { formatearPesos } from '../../utils/formato';
import { aMinutos, minutosAhora } from '../../utils/horas';
import { colorDeTurno } from '../agenda/GrillaAgenda';

// Pestaña "Inicio": el resumen de hoy (en cancha ahora, próximos turnos y lo que falta cobrar)
export function HoyScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const [datos, setDatos] = useState<{ fecha: string; agenda: Agenda; caja: Caja } | null>(null);
  const [error, setError] = useState('');
  const [recargando, setRecargando] = useState(false);
  const [ahora, setAhora] = useState(minutosAhora);

  const cargar = useCallback(async () => {
    const hoy = hoyISO();
    try {
      // La agenda va primero: crea los turnos fijos de hoy antes de calcular la caja
      const agenda = await agendaApi.dia(hoy);
      const caja = await cobrosApi.caja(hoy);
      setDatos({ fecha: hoy, agenda, caja });
      setError('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setRecargando(false);
      setAhora(minutosAhora());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  // "En cancha ahora" cambia con el reloj
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(minutosAhora()), 60000);
    return () => clearInterval(intervalo);
  }, []);

  if (!datos) {
    return error ? (
      <ErrorCarga mensaje={error} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const { agenda, caja } = datos;
  const canchas = new Map(agenda.canchas.map(c => [c.id, c.nombre]));
  const activos = agenda.turnos.filter(turnoActivo);
  const enCancha = activos.filter(t => aMinutos(t.horaInicio) <= ahora && ahora < aMinutos(t.horaFin));
  const proximos = activos.filter(t => aMinutos(t.horaInicio) > ahora);

  const fila = (t: Turno, derecha: string, colorDerecha = colores.texto) => (
    <Pressable
      key={t.id}
      accessibilityRole="button"
      accessibilityHint="Abre el turno"
      onPress={() => navigation.navigate('Turno', { id: t.id })}
      style={({ pressed }) => [
        estilos.item,
        {
          backgroundColor: colores.superficie,
          borderColor: colores.borde,
          borderLeftColor: colorDeTurno(t, colores),
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <Text style={[estilos.hora, { color: colores.texto }]}>{t.horaInicio}</Text>
      <View style={estilos.datos}>
        <Text numberOfLines={1} style={[estilos.nombre, { color: colores.texto }]}>
          {t.cliente.nombre}
        </Text>
        <Text numberOfLines={1} style={[estilos.detalle, { color: colores.textoSecundario }]}>
          {canchas.get(t.canchaId)} · {NOMBRE_PAGO[t.estadoPago]}
        </Text>
      </View>
      <Text style={[estilos.derecha, { color: colorDerecha }]}>{derecha}</Text>
    </Pressable>
  );

  const seccion = (titulo: string, vacio: string, items: React.ReactNode[]) => (
    <>
      <Text style={[estilos.seccion, { color: colores.texto }]}>{titulo}</Text>
      {items.length > 0 ? items : <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>{vacio}</Text>}
    </>
  );

  const fecha = fechaLarga(datos.fecha);

  return (
    <ScrollView
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
      refreshControl={
        <RefreshControl
          refreshing={recargando}
          onRefresh={() => {
            setRecargando(true);
            cargar();
          }}
          colors={[colores.primario]}
        />
      }>
      <Text style={[estilos.fecha, { color: colores.textoSecundario }]}>
        {fecha.charAt(0).toUpperCase() + fecha.slice(1)} · {agenda.complejo.nombre}
      </Text>
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.aviso, { color: colores.error }]}>
          {error}
        </Text>
      )}

      <View style={estilos.fila}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Abre la caja del día"
          onPress={() => navigation.navigate('Caja')}
          style={[estilos.dato, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
          <Text style={[estilos.tituloDato, { color: colores.textoSecundario }]}>Cobrado hoy</Text>
          <Text style={[estilos.montoDato, { color: colores.texto }]}>{formatearPesos(caja.totales.total)}</Text>
        </Pressable>
        <View style={estilos.separador} />
        <View style={[estilos.dato, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
          <Text style={[estilos.tituloDato, { color: colores.textoSecundario }]}>Falta cobrar</Text>
          <Text style={[estilos.montoDato, { color: caja.totalPorCobrar > 0 ? colores.ocupada : colores.texto }]}>
            {formatearPesos(caja.totalPorCobrar)}
          </Text>
        </View>
      </View>

      {seccion(
        'En cancha ahora',
        'No hay ningún turno jugándose en este momento.',
        enCancha.map(t => fila(t, `hasta ${t.horaFin}`)),
      )}
      {seccion(
        'Próximos turnos',
        activos.length === 0 ? 'No hay turnos cargados para hoy.' : 'No quedan más turnos por hoy.',
        proximos.map(t => fila(t, formatearPesos(t.total))),
      )}
      {seccion(
        'Falta cobrar',
        'Todos los turnos de hoy están cobrados.',
        caja.porCobrar.map(t => fila(t, formatearPesos(t.total - t.pagado), colores.ocupada)),
      )}

      <View style={estilos.espacio} />
      <Boton titulo="Ver caja del día" variante="secundario" onPress={() => navigation.navigate('Caja')} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenido: { padding: espaciado.m, paddingBottom: espaciado.xl },
  fecha: { fontSize: 15, marginBottom: espaciado.m },
  aviso: { fontSize: 14, marginBottom: espaciado.s },
  fila: { flexDirection: 'row' },
  separador: { width: espaciado.s },
  dato: { flex: 1, borderWidth: 1, borderRadius: radio, padding: espaciado.m },
  tituloDato: { fontSize: 14, fontWeight: '600' },
  montoDato: { fontSize: 24, fontWeight: '800', marginTop: espaciado.xs },
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
  derecha: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  espacio: { height: espaciado.m },
});
