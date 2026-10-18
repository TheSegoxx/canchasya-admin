import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { urlDeFoto } from '../../api/cliente';
import { NOMBRE_DEPORTE } from '../../api/canchas';
import { SERVICIOS } from '../../api/complejo';
import { CanchaFicha, ComplejoFicha, explorarApi } from '../../api/explorar';
import { Boton } from '../../components/Boton';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Icono } from '../../components/Icono';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasJugador } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { abrirMapa, abrirWhatsApp, llamar } from '../../utils/acciones';
import { formatearPesos } from '../../utils/formato';
import { textoPlazoCancelacion } from '../../utils/reservas';

type Props = NativeStackScreenProps<RutasJugador, 'ComplejoJugador'>;

// El teléfono del complejo se guarda como lo escribió el dueño: para WhatsApp y llamar van solo las cifras
const cifras = (telefono: string) => telefono.replace(/\D/g, '');

// Ficha del complejo para el jugador: fotos, dónde queda, contacto, horario, servicios y canchas con precios
export function ComplejoJugadorScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const { width } = useWindowDimensions();
  const [complejo, setComplejo] = useState<ComplejoFicha | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setComplejo((await explorarApi.ficha(route.params.id)).complejo);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }, [route.params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const alternarFavorito = useCallback(async () => {
    if (!complejo) {
      return;
    }
    const nuevo = !complejo.favorito;
    setComplejo({ ...complejo, favorito: nuevo });
    try {
      await explorarApi.favorito(complejo.id, nuevo);
    } catch (e) {
      setComplejo({ ...complejo, favorito: !nuevo });
      Alert.alert('Favoritos', mensajeDeError(e));
    }
  }, [complejo]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: route.params.nombre });
  }, [navigation, route.params.nombre]);

  if (!complejo) {
    return error ? (
      <ErrorCarga mensaje={error} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  // Las fotos del complejo y después las de sus canchas
  const fotos = [...complejo.fotos, ...complejo.canchas.flatMap(c => c.fotos)];
  const lugar = [complejo.direccion, complejo.ciudad].filter(Boolean).join(', ');
  const telefono = complejo.telefono ? cifras(complejo.telefono) : null;
  const cerrar = complejo.horaCierre === '24:00' ? 'medianoche' : `las ${complejo.horaCierre}`;
  const reglas = complejo.reservas;
  const reservar = (canchaId?: number) => navigation.navigate('Reservar', { complejoId: complejo.id, canchaId });

  const comoLlegar = () =>
    complejo.ubicacion
      ? abrirMapa(complejo.ubicacion)
      : Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar)}`).catch(() =>
          Alert.alert('No se pudo abrir el mapa', 'Este celular no pudo abrir Google Maps ni el navegador.'),
        );

  return (
    <ScrollView style={{ backgroundColor: colores.fondo }} contentContainerStyle={estilos.contenido}>
      {fotos.length > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {fotos.map(ruta => (
            <Image
              key={ruta}
              source={{ uri: urlDeFoto(ruta) }}
              style={[estilos.foto, { width, backgroundColor: colores.borde }]}
              accessibilityIgnoresInvertColors
            />
          ))}
        </ScrollView>
      ) : (
        <View style={[estilos.foto, estilos.sinFoto, { width, backgroundColor: colores.primario + '14' }]}>
          <Icono nombre="canchas" color={colores.primario} acento={colores.acento} tamano={56} />
        </View>
      )}
      {fotos.length > 1 && (
        <Text style={[estilos.cantidadFotos, { color: colores.textoSecundario }]}>
          {fotos.length} fotos · deslizá para verlas
        </Text>
      )}

      <View style={estilos.cuerpo}>
        <View style={estilos.encabezado}>
          <View style={estilos.titulo}>
            <Text style={[estilos.nombre, { color: colores.texto }]}>{complejo.nombre}</Text>
            <Text style={[estilos.lugar, { color: colores.textoSecundario }]}>{lugar}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={complejo.favorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            onPress={alternarFavorito}
            hitSlop={10}
            style={[estilos.corazon, { borderColor: colores.borde }]}>
            <Icono
              nombre={complejo.favorito ? 'favoritoLleno' : 'favorito'}
              color={complejo.favorito ? colores.error : colores.texto}
              acento={colores.error}
            />
          </Pressable>
        </View>

        <View style={estilos.botonLlegar}>
          <Boton titulo="Cómo llegar" icono="ubicacion" variante="secundario" onPress={comoLlegar} />
        </View>
        {telefono && (
          <View style={estilos.acciones}>
            <View style={estilos.accion}>
              <Boton
                titulo="WhatsApp"
                icono="whatsapp"
                variante="secundario"
                onPress={() => abrirWhatsApp(telefono, `¡Hola! Te escribo desde CanchasYa por ${complejo.nombre}.`)}
              />
            </View>
            <View style={estilos.accion}>
              <Boton titulo="Llamar" icono="telefono" variante="secundario" onPress={() => llamar(telefono)} />
            </View>
          </View>
        )}

        <View style={[estilos.dato, { borderColor: colores.borde }]}>
          <Icono nombre="reloj" color={colores.texto} acento={colores.acento} tamano={22} />
          <Text style={[estilos.textoDato, { color: colores.texto }]}>
            Abre de {complejo.horaApertura} a {cerrar}
          </Text>
        </View>

        {complejo.servicios.length > 0 && (
          <>
            <Text style={[estilos.seccion, { color: colores.texto }]}>Servicios</Text>
            <View style={estilos.servicios}>
              {SERVICIOS.filter(s => complejo.servicios.includes(s.clave)).map(s => (
                <View key={s.clave} style={[estilos.servicio, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
                  <Text style={[estilos.textoServicio, { color: colores.texto }]}>✓ {s.nombre}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={[estilos.seccion, { color: colores.texto }]}>Canchas</Text>
        {complejo.canchas.map(c => (
          <TarjetaCancha key={c.id} cancha={c} onPress={reglas.aceptaReservas ? () => reservar(c.id) : undefined} />
        ))}

        <View style={estilos.reservar}>
          {reglas.aceptaReservas ? (
            <>
              <Boton titulo="Reservar" icono="agenda" onPress={() => reservar()} />
              <Text style={[estilos.reglas, { color: colores.textoSecundario }]}>
                {reglas.senaPorcentaje > 0 ? `Seña del ${reglas.senaPorcentaje} % para reservar` : 'Reservás sin pagar seña'} ·
                Cancelás sin cargo {textoPlazoCancelacion(reglas.cancelacionHoras)}
              </Text>
            </>
          ) : (
            <Text style={[estilos.reglas, { color: colores.textoSecundario }]}>
              Este complejo todavía no toma reservas por la app.{telefono ? ' Escribiles por WhatsApp para reservar.' : ''}
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// Una cancha con sus características y precios (el de siempre y los de cada franja horaria).
// Si el complejo toma reservas, tocarla lleva a reservar esa cancha.
function TarjetaCancha({ cancha, onPress }: { cancha: CanchaFicha; onPress?: () => void }) {
  const { colores } = useTema();
  const detalles = [NOMBRE_DEPORTE[cancha.deporte], cancha.superficie, cancha.techada ? 'Techada' : 'Al aire libre']
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'Reservar esta cancha' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.cancha,
        { backgroundColor: colores.superficie, borderColor: colores.borde, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={estilos.cabeceraCancha}>
        <Icono nombre={cancha.deporte} color={colores.primario} tamano={22} />
        <View style={estilos.datosCancha}>
          <Text style={[estilos.nombreCancha, { color: colores.texto }]}>{cancha.nombre}</Text>
          <Text style={[estilos.detalleCancha, { color: colores.textoSecundario }]}>{detalles}</Text>
        </View>
        {cancha.techada && <Icono nombre="techada" color={colores.textoSecundario} acento={colores.acento} tamano={20} />}
        {onPress && <Icono nombre="siguiente" color={colores.inactivo} tamano={18} />}
      </View>
      <View style={[estilos.precios, { borderTopColor: colores.borde }]}>
        <Text style={[estilos.precio, { color: colores.texto }]}>
          Turno de {cancha.duracionMin} min:{' '}
          <Text style={[estilos.monto, { color: colores.primario }]}>{formatearPesos(cancha.precioBase)}</Text>
        </Text>
        {cancha.franjas.map(f => (
          <Text key={f.id} style={[estilos.precio, { color: colores.textoSecundario }]}>
            De {f.horaDesde} a {f.horaHasta === '24:00' ? '00:00' : f.horaHasta}: {formatearPesos(f.precio)}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenido: { paddingBottom: espaciado.xl },
  foto: { aspectRatio: 1.8 },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  cantidadFotos: { fontSize: 12, textAlign: 'center', marginTop: espaciado.xs },
  cuerpo: { padding: espaciado.m },
  encabezado: { flexDirection: 'row', alignItems: 'flex-start' },
  titulo: { flex: 1, marginRight: espaciado.m },
  corazon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nombre: { fontSize: 24, fontWeight: '700' },
  lugar: { fontSize: 15, marginTop: 2 },
  botonLlegar: { marginTop: espaciado.m },
  acciones: { flexDirection: 'row', marginTop: espaciado.s, marginHorizontal: -4 },
  accion: { flex: 1, marginHorizontal: 4 },
  dato: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: espaciado.m,
    marginTop: espaciado.m,
  },
  textoDato: { fontSize: 15, marginLeft: espaciado.m },
  seccion: { fontSize: 18, fontWeight: '700', marginTop: espaciado.l, marginBottom: espaciado.s },
  servicios: { flexDirection: 'row', flexWrap: 'wrap' },
  servicio: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  textoServicio: { fontSize: 13, fontWeight: '500' },
  cancha: { borderRadius: radio, borderWidth: StyleSheet.hairlineWidth, marginBottom: espaciado.s },
  cabeceraCancha: { flexDirection: 'row', alignItems: 'center', padding: espaciado.m },
  datosCancha: { flex: 1, marginLeft: espaciado.m },
  nombreCancha: { fontSize: 16, fontWeight: '700' },
  detalleCancha: { fontSize: 13, marginTop: 2 },
  precios: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: espaciado.m, paddingVertical: espaciado.s },
  precio: { fontSize: 14, marginVertical: 2 },
  monto: { fontWeight: '700' },
  reservar: { marginTop: espaciado.l },
  reglas: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: espaciado.s },
});
