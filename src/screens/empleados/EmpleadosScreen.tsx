import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useFocusEffect } from '@react-navigation/native';
import { Empleado, empleadosApi, Invitacion } from '../../api/empleados';
import { Boton } from '../../components/Boton';
import { Icono } from '../../components/Icono';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import { espaciado, radio, useTema } from '../../theme/tema';
import { fechaCorta } from '../../utils/fechas';

// Encargados del complejo: invitarlos con un código y quitarles el acceso
export function EmpleadosScreen() {
  const { colores } = useTema();
  const { usuario } = useSesion();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [nuevo, setNuevo] = useState<{ codigo: string; venceEn: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [invitando, setInvitando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const datos = await empleadosApi.listar();
      setEmpleados(datos.empleados);
      setInvitaciones(datos.invitaciones);
      setError('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const mensaje = (codigo: string, venceEn: string) =>
    `¡Hola! Te invito a usar CanchasYa como encargado de ${usuario?.complejo ?? 'mi complejo'}. ` +
    `Instalá la app, creá tu cuenta y en "Unirme a un complejo" escribí este código: ${codigo} ` +
    `(vence el ${fechaCorta(venceEn)}).`;

  const invitar = async () => {
    setInvitando(true);
    try {
      const { codigo, invitacion } = await empleadosApi.invitar();
      setNuevo({ codigo, venceEn: invitacion.venceEn });
      setInvitaciones(lista => [...lista, invitacion]);
    } catch (e) {
      Alert.alert('No se pudo crear la invitación', mensajeDeError(e));
    } finally {
      setInvitando(false);
    }
  };

  const confirmar = (titulo: string, detalle: string, boton: string, accion: () => Promise<unknown>) =>
    Alert.alert(titulo, detalle, [
      { text: 'Volver', style: 'cancel' },
      {
        text: boton,
        style: 'destructive',
        onPress: async () => {
          try {
            await accion();
            cargar();
          } catch (e) {
            Alert.alert('No se pudo', mensajeDeError(e));
          }
        },
      },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
      refreshControl={
        <RefreshControl
          refreshing={cargando}
          onRefresh={() => {
            setCargando(true);
            cargar();
          }}
          colors={[colores.primario]}
        />
      }>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        Un encargado puede reservar turnos, cobrar, cargar extras y ver la caja del día. No ve el dashboard ni puede
        cambiar precios, datos del complejo ni borrar cobros.
      </Text>

      {nuevo ? (
        <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.primario }]}>
          <Text style={[estilos.etiqueta, { color: colores.textoSecundario }]}>Código de invitación</Text>
          <Text selectable style={[estilos.codigo, { color: colores.texto }]}>
            {nuevo.codigo}
          </Text>
          <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
            Sirve una sola vez y vence el {fechaCorta(nuevo.venceEn)}. Mandalo ahora: después no se puede volver a ver.
          </Text>
          <View style={estilos.espacio} />
          <Boton
            titulo="Compartir código"
            icono="whatsapp"
            color={colores.whatsapp}
            onPress={() => Share.share({ message: mensaje(nuevo.codigo, nuevo.venceEn) })}
          />
          <Boton titulo="Listo" variante="texto" onPress={() => setNuevo(null)} />
        </View>
      ) : (
        <Boton titulo="Invitar a un encargado" onPress={invitar} cargando={invitando} />
      )}

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}

      <Text style={[estilos.seccion, { color: colores.texto }]}>Encargados</Text>
      {empleados.length === 0 ? (
        <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>Todavía no hay encargados.</Text>
      ) : (
        empleados.map(e => (
          <View key={e.id} style={[estilos.fila, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
            <Icono nombre="persona" color={colores.primario} />
            <View style={estilos.datos}>
              <Text style={[estilos.nombre, { color: colores.texto }]}>{e.nombre}</Text>
              <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>{e.email}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Quitar el acceso a ${e.nombre}`}
              onPress={() =>
                confirmar(
                  'Quitar acceso',
                  `${e.nombre} no va a poder entrar más a tu complejo. Sus turnos y cobros quedan guardados.`,
                  'Quitar acceso',
                  () => empleadosApi.quitar(e.id),
                )
              }
              hitSlop={8}
              style={estilos.borrar}>
              <Icono nombre="borrar" color={colores.error} tamano={22} />
            </Pressable>
          </View>
        ))
      )}

      {invitaciones.length > 0 && (
        <>
          <Text style={[estilos.seccion, { color: colores.texto }]}>Invitaciones sin usar</Text>
          {invitaciones.map(i => (
            <View key={i.id} style={[estilos.fila, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
              <Text style={[estilos.datos, estilos.detalle, { color: colores.texto }]}>Vence el {fechaCorta(i.venceEn)}</Text>
              <Boton
                titulo="Anular"
                variante="texto"
                color={colores.error}
                onPress={() =>
                  confirmar('Anular invitación', 'El código deja de servir.', 'Anular', () => empleadosApi.anular(i.id))
                }
              />
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espaciado.m, paddingBottom: espaciado.xl },
  ayuda: { fontSize: 15, lineHeight: 21, marginBottom: espaciado.l },
  tarjeta: { borderWidth: 1.5, borderRadius: radio, padding: espaciado.m, alignItems: 'stretch' },
  etiqueta: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  codigo: { fontSize: 34, fontWeight: '800', letterSpacing: 4, textAlign: 'center', marginVertical: espaciado.s },
  detalle: { fontSize: 14, lineHeight: 20 },
  espacio: { height: espaciado.m },
  error: { fontSize: 14, marginTop: espaciado.m },
  seccion: { fontSize: 17, fontWeight: '700', marginTop: espaciado.l, marginBottom: espaciado.s },
  vacio: { fontSize: 15 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingLeft: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    marginBottom: espaciado.s,
  },
  datos: { flex: 1, marginLeft: espaciado.m },
  nombre: { fontSize: 16, fontWeight: '700' },
  borrar: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
});
