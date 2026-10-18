import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { complejoApi, ReglasReservas } from '../../api/complejo';
import { Boton } from '../../components/Boton';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { FilaInterruptor } from '../../components/FilaInterruptor';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { formatearPesos } from '../../utils/formato';
import { montoSena, textoDuracion, textoPlazoCancelacion } from '../../utils/reservas';

type Props = NativeStackScreenProps<RutasApp, 'ReservasOnline'>;

type Opcion = { valor: number; texto: string };

const SENAS: Opcion[] = [
  { valor: 0, texto: 'Sin seña' },
  { valor: 10, texto: '10 %' },
  { valor: 20, texto: '20 %' },
  { valor: 30, texto: '30 %' },
  { valor: 50, texto: '50 %' },
  { valor: 100, texto: 'Todo' },
];
const PLAZOS_SENA: Opcion[] = [15, 30, 60, 120].map(m => ({ valor: m, texto: textoDuracion(m) }));
const ANTICIPACION: Opcion[] = [
  { valor: 7, texto: '1 semana' },
  { valor: 14, texto: '2 semanas' },
  { valor: 30, texto: '1 mes' },
];
const CANCELACION: Opcion[] = [0, 2, 12, 24, 48].map(h => ({
  valor: h,
  texto: h === 0 ? 'Hasta que empiece' : `${h} h antes`,
}));

// Un turno de ejemplo para que el dueño vea cuánto pide de seña
const PRECIO_EJEMPLO = 36000;

// Cómo toma reservas el complejo desde la app de los jugadores: seña y plazos
export function ReservasOnlineScreen({ navigation }: Props) {
  const { colores } = useTema();
  const [reglas, setReglas] = useState<ReglasReservas | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      setReglas((await complejoApi.obtener()).complejo.reservas);
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!reglas) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const cambiar = (cambio: Partial<ReglasReservas>) => setReglas({ ...reglas, ...cambio });

  const guardar = async () => {
    setGuardando(true);
    try {
      await complejoApi.guardarReglasReservas(reglas);
      navigation.goBack();
    } catch (e) {
      Alert.alert('No se pudo guardar', mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const grupo = (titulo: string, opciones: Opcion[], valor: number, onElegir: (v: number) => void, ayuda?: string) => (
    <View style={estilos.grupo}>
      <Text style={[estilos.titulo, { color: colores.texto }]}>{titulo}</Text>
      {!!ayuda && <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>{ayuda}</Text>}
      <View style={estilos.chips}>
        {opciones.map(o => (
          <Chip key={o.valor} texto={o.texto} seleccionado={valor === o.valor} onPress={() => onElegir(o.valor)} />
        ))}
      </View>
    </View>
  );

  const sena = montoSena(PRECIO_EJEMPLO, reglas.senaPorcentaje);
  const resumen = [
    sena !== null
      ? `Un turno de ${formatearPesos(PRECIO_EJEMPLO)} pide ${formatearPesos(sena)} de seña por Mercado Pago. ` +
        `Si no la pagan en ${textoDuracion(reglas.senaMinutos)}, el horario se libera solo.`
      : 'Se reserva sin pagar nada: el jugador paga en el complejo (o todo por Mercado Pago, si quiere).',
    `Pueden reservar con hasta ${ANTICIPACION.find(a => a.valor === reglas.reservaDias)?.texto ?? `${reglas.reservaDias} días`} de anticipación ` +
      `y cancelar ${textoPlazoCancelacion(reglas.cancelacionHoras)}.`,
  ];

  return (
    <Pantalla>
      <FilaInterruptor
        titulo="Tomar reservas desde la app"
        descripcion="Los jugadores reservan solos los horarios libres y ves todo en la agenda."
        valor={reglas.aceptaReservas}
        onCambiar={valor => cambiar({ aceptaReservas: valor })}
      />

      {reglas.aceptaReservas && (
        <>
          {grupo('Seña para reservar', SENAS, reglas.senaPorcentaje, v => cambiar({ senaPorcentaje: v }), 'Porcentaje del total que se paga al reservar.')}
          {reglas.senaPorcentaje > 0 &&
            grupo('Tiempo para pagar la seña', PLAZOS_SENA, reglas.senaMinutos, v => cambiar({ senaMinutos: v }))}
          {grupo('Se puede reservar con', ANTICIPACION, reglas.reservaDias, v => cambiar({ reservaDias: v }), 'Hasta cuánto antes se reserva.')}
          {grupo(
            'Cancelación sin cargo',
            CANCELACION,
            reglas.cancelacionHoras,
            v => cambiar({ cancelacionHoras: v }),
            'Hasta cuándo el jugador puede cancelar desde la app. Si había pagado, te avisamos para que le devuelvas la plata.',
          )}

          <View style={[estilos.resumen, { backgroundColor: colores.primario + '14', borderColor: colores.primario + '55' }]}>
            {resumen.map(linea => (
              <Text key={linea} style={[estilos.textoResumen, { color: colores.texto }]}>
                {linea}
              </Text>
            ))}
          </View>
        </>
      )}

      <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grupo: { marginBottom: espaciado.m },
  titulo: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  ayuda: { fontSize: 13, lineHeight: 18, marginBottom: espaciado.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: espaciado.xs },
  resumen: { borderWidth: 1, borderRadius: radio, padding: espaciado.m, marginBottom: espaciado.l },
  textoResumen: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
