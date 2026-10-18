import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Nivel, NOMBRE_NIVEL } from '../../api/jugador';
import { Reserva, reservasApi } from '../../api/reservas';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasJugador } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { fechaRelativa } from '../../utils/fechas';

type Props = NativeStackScreenProps<RutasJugador, 'MeFaltaUno'>;

const NIVELES: Nivel[] = ['cualquiera', 'principiante', 'intermedio', 'avanzado'];

// "Me falta uno": publicar que el partido busca jugadores (o cambiar cuántos y de qué nivel)
export function MeFaltaUnoScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const { id } = route.params;
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [faltan, setFaltan] = useState(1);
  const [nivel, setNivel] = useState<Nivel>('cualquiera');
  const [comentario, setComentario] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      const { reserva: datos } = await reservasApi.obtener(id);
      setReserva(datos);
      // Si ya buscaba, se arranca con lo que tenía publicado
      if (datos.meFaltaUno) {
        setFaltan(datos.meFaltaUno.buscan);
        setNivel(datos.meFaltaUno.nivel);
        setComentario(datos.meFaltaUno.comentario ?? '');
      }
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    }
  }, [id]);

  useEffect(() => {
    cargar();
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

  const sumados = reserva.meFaltaUno?.sumados.length ?? 0;

  const publicar = async () => {
    setGuardando(true);
    try {
      await reservasApi.publicarMeFaltaUno(reserva.id, { faltan, nivel, comentario: comentario.trim() });
      navigation.goBack();
    } catch (e) {
      Alert.alert('No se pudo publicar', mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const botonContador = (signo: '−' | '+', habilitado: boolean, valor: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={signo === '+' ? 'Uno más' : 'Uno menos'}
      disabled={!habilitado}
      onPress={() => setFaltan(valor)}
      hitSlop={6}
      style={({ pressed }) => [estilos.botonContador, { borderColor: colores.borde, opacity: !habilitado ? 0.35 : pressed ? 0.6 : 1 }]}>
      <Text style={[estilos.signo, { color: colores.primario }]}>{signo}</Text>
    </Pressable>
  );

  return (
    <Pantalla>
      <Text style={[estilos.titulo, { color: colores.texto }]}>Buscá jugadores para tu partido</Text>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        {reserva.cancha.nombre} en {reserva.complejo.nombre}, {fechaRelativa(reserva.fecha).toLowerCase()} a las{' '}
        {reserva.horaInicio}. Aparece en "Partidos" para los demás jugadores; cuando alguien se suma te avisamos y ven el
        celular uno del otro para coordinar.
      </Text>

      <Text style={[estilos.seccion, { color: colores.texto }]}>¿Cuántos les faltan?</Text>
      <View style={[estilos.contador, { borderColor: colores.borde, backgroundColor: colores.superficie }]}>
        {botonContador('−', faltan > Math.max(1, sumados), faltan - 1)}
        <Text style={[estilos.cantidad, { color: colores.texto }]}>{faltan === 1 ? 'Falta 1' : `Faltan ${faltan}`}</Text>
        {botonContador('+', faltan < 9, faltan + 1)}
      </View>

      <Text style={[estilos.seccion, { color: colores.texto }]}>Nivel</Text>
      <View style={estilos.chips}>
        {NIVELES.map(n => (
          <Chip key={n} texto={NOMBRE_NIVEL[n]} seleccionado={nivel === n} onPress={() => setNivel(n)} />
        ))}
      </View>

      <CampoTexto
        etiqueta="Comentario (opcional)"
        value={comentario}
        onChangeText={setComentario}
        placeholder="Ej.: buscamos arquero, jugamos tranqui"
        maxLength={140}
      />

      <Boton titulo={reserva.meFaltaUno && !reserva.meFaltaUno.cerrado ? 'Guardar cambios' : 'Publicar'} onPress={publicar} cargando={guardando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 20, fontWeight: '700', marginBottom: espaciado.xs },
  ayuda: { fontSize: 14, lineHeight: 20, marginBottom: espaciado.m },
  seccion: { fontSize: 16, fontWeight: '700', marginBottom: espaciado.s },
  contador: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radio,
    padding: espaciado.s,
    marginBottom: espaciado.m,
  },
  botonContador: { width: 48, height: 48, borderRadius: radio - 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  signo: { fontSize: 26, fontWeight: '600', lineHeight: 30 },
  cantidad: { fontSize: 18, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.s },
});
