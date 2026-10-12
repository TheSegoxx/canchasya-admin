import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { canchasApi, Deporte, Franja, NOMBRE_DEPORTE } from '../../api/canchas';
import { Foto, MAXIMO_FOTOS_CANCHA } from '../../api/fotos';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { FilaInterruptor } from '../../components/FilaInterruptor';
import { GaleriaFotos } from '../../components/GaleriaFotos';
import { Icono } from '../../components/Icono';
import { Pantalla } from '../../components/Pantalla';
import { SelectorHora } from '../../components/SelectorHora';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { formatearPesos, leerPesos, pesosParaEditar } from '../../utils/formato';
import { sumarMinutos } from '../../utils/horas';

type Props = NativeStackScreenProps<RutasApp, 'Cancha'>;

// Alta (sin id) o edición (con id) de una cancha
export function CanchaScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const id = route.params?.id;

  const [deporte, setDeporte] = useState<Deporte>('padel');
  const [nombre, setNombre] = useState('');
  const [superficie, setSuperficie] = useState('');
  const [techada, setTechada] = useState(false);
  const [duracion, setDuracion] = useState<60 | 90>(60);
  const [precio, setPrecio] = useState('');
  const [habilitada, setHabilitada] = useState(true);
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);

  const [cargando, setCargando] = useState(id !== undefined);
  const [errorCarga, setErrorCarga] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async (canchaId: number) => {
    setCargando(true);
    setErrorCarga('');
    try {
      const { cancha, franjas: lista, fotos: guardadas } = await canchasApi.obtener(canchaId);
      setFotos(guardadas);
      setDeporte(cancha.deporte);
      setNombre(cancha.nombre);
      setSuperficie(cancha.superficie ?? '');
      setTechada(cancha.techada);
      setDuracion(cancha.duracionMin);
      setPrecio(pesosParaEditar(cancha.precioBase));
      setHabilitada(cancha.habilitada);
      setFranjas(lista);
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: id === undefined ? 'Nueva cancha' : 'Editar cancha' });
    if (id !== undefined) {
      cargar(id);
    }
  }, [id, navigation, cargar]);

  const guardar = async () => {
    if (guardando) {
      return;
    }
    const precioBase = leerPesos(precio);
    if (!nombre.trim()) {
      setError('Poné un nombre para la cancha (por ejemplo, "Pádel 1").');
      return;
    }
    if (precioBase === null) {
      setError('Escribí el precio del turno solo con números (por ejemplo, 24000).');
      return;
    }
    setError('');
    setGuardando(true);
    const datos = {
      nombre: nombre.trim(),
      deporte,
      superficie: superficie.trim() || null,
      techada,
      duracionMin: duracion,
      precioBase,
    };
    try {
      if (id === undefined) {
        await canchasApi.crear(datos);
      } else {
        await canchasApi.editar(id, datos);
      }
      navigation.goBack();
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  };

  // Se aplica al momento, sin esperar a "Guardar"
  const alternarHabilitada = async (valor: boolean) => {
    if (id === undefined) {
      return;
    }
    setHabilitada(valor);
    try {
      await canchasApi.cambiarHabilitada(id, valor);
    } catch (e) {
      setHabilitada(!valor);
      Alert.alert('No se pudo cambiar', mensajeDeError(e));
    }
  };

  if (cargando) {
    return (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  if (errorCarga && id !== undefined) {
    return <ErrorCarga mensaje={errorCarga} onReintentar={() => cargar(id)} />;
  }

  return (
    <Pantalla>
      {id !== undefined && (
        <GaleriaFotos titulo="Fotos" fotos={fotos} maximo={MAXIMO_FOTOS_CANCHA} canchaId={id} onCambio={setFotos} />
      )}

      <Text style={[estilos.seccion, { color: colores.texto }]}>Deporte</Text>
      <View style={estilos.chips}>
        {(['padel', 'futbol5'] as Deporte[]).map(d => (
          <Chip key={d} texto={NOMBRE_DEPORTE[d]} seleccionado={deporte === d} onPress={() => setDeporte(d)} />
        ))}
      </View>

      <CampoTexto
        etiqueta="Nombre"
        value={nombre}
        onChangeText={setNombre}
        placeholder={deporte === 'padel' ? 'Pádel 1' : 'Fútbol 5 - Cancha A'}
        maxLength={50}
      />
      <CampoTexto
        etiqueta="Superficie (opcional)"
        value={superficie}
        onChangeText={setSuperficie}
        placeholder={deporte === 'padel' ? 'Césped sintético' : 'Sintético'}
        maxLength={50}
      />
      <FilaInterruptor titulo="Techada" descripcion="Se puede jugar con lluvia" valor={techada} onCambiar={setTechada} />

      <Text style={[estilos.seccion, { color: colores.texto }]}>Duración del turno</Text>
      <View style={estilos.chips}>
        {([60, 90] as const).map(d => (
          <Chip key={d} texto={`${d} minutos`} seleccionado={duracion === d} onPress={() => setDuracion(d)} />
        ))}
      </View>

      <CampoTexto
        etiqueta="Precio del turno ($)"
        value={precio}
        onChangeText={setPrecio}
        keyboardType="numeric"
        placeholder="24000"
      />

      {id !== undefined && (
        <FilaInterruptor
          titulo="Habilitada"
          descripcion={habilitada ? 'Disponible para cargar turnos' : 'No se pueden cargar turnos nuevos'}
          valor={habilitada}
          onCambiar={alternarHabilitada}
        />
      )}

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo={id === undefined ? 'Crear cancha' : 'Guardar cambios'} onPress={guardar} cargando={guardando} />

      {id !== undefined && <FranjasPrecio canchaId={id} franjas={franjas} onCambio={setFranjas} />}
    </Pantalla>
  );
}

type PropsFranjas = {
  canchaId: number;
  franjas: Franja[];
  // Recibe una función para partir siempre de la lista más reciente
  onCambio: (cambio: (actuales: Franja[]) => Franja[]) => void;
};

// Precios distintos según el horario (por ejemplo, más caro a la noche)
function FranjasPrecio({ canchaId, franjas, onCambio }: PropsFranjas) {
  const { colores } = useTema();
  const [desde, setDesde] = useState('18:00');
  const [hasta, setHasta] = useState('23:00');
  const [precio, setPrecio] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState('');

  const agregar = async () => {
    if (agregando) {
      return;
    }
    const monto = leerPesos(precio);
    if (monto === null) {
      setError('Escribí el precio de la franja solo con números.');
      return;
    }
    setError('');
    setAgregando(true);
    try {
      const { franja } = await canchasApi.crearFranja(canchaId, { horaDesde: desde, horaHasta: hasta, precio: monto });
      onCambio(actuales => [...actuales, franja].sort((a, b) => a.horaDesde.localeCompare(b.horaDesde)));
      setPrecio('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setAgregando(false);
    }
  };

  const borrar = (franja: Franja) =>
    Alert.alert('Borrar franja', `¿Borrar el precio de ${franja.horaDesde} a ${franja.horaHasta}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await canchasApi.borrarFranja(franja.id);
            onCambio(actuales => actuales.filter(f => f.id !== franja.id));
          } catch (e) {
            Alert.alert('No se pudo borrar', mensajeDeError(e));
          }
        },
      },
    ]);

  return (
    <View style={[estilos.franjas, { borderTopColor: colores.borde }]}>
      <Text style={[estilos.seccion, { color: colores.texto }]}>Precios por horario</Text>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        Fuera de estas franjas se cobra el precio del turno de arriba.
      </Text>

      {franjas.map(f => (
        <View key={f.id} style={[estilos.franja, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
          <Text style={[estilos.textoFranja, { color: colores.texto }]}>
            {f.horaDesde} a {f.horaHasta}
          </Text>
          <Text style={[estilos.precioFranja, { color: colores.texto }]}>{formatearPesos(f.precio)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Borrar franja de ${f.horaDesde} a ${f.horaHasta}`}
            onPress={() => borrar(f)}
            hitSlop={8}
            style={estilos.borrar}>
            <Icono nombre="borrar" color={colores.error} tamano={22} />
          </Pressable>
        </View>
      ))}

      <View style={estilos.horas}>
        <SelectorHora etiqueta="Desde" valor={desde} onCambiar={setDesde} maximo={sumarMinutos(hasta, -30)} />
        <View style={estilos.separadorHoras} />
        <SelectorHora etiqueta="Hasta" valor={hasta} onCambiar={setHasta} minimo={sumarMinutos(desde, 30)} />
      </View>
      <CampoTexto
        etiqueta="Precio en esa franja ($)"
        value={precio}
        onChangeText={setPrecio}
        keyboardType="numeric"
        placeholder="30000"
      />
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo="Agregar franja" variante="secundario" onPress={agregar} cargando={agregando} />
    </View>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  seccion: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.s },
  ayuda: { fontSize: 14, marginBottom: espaciado.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.m },
  error: { fontSize: 14, marginBottom: espaciado.m },
  franjas: { marginTop: espaciado.xl, paddingTop: espaciado.l, borderTopWidth: 1 },
  franja: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: espaciado.m,
    borderWidth: 1,
    borderRadius: radio,
    marginBottom: espaciado.s,
  },
  textoFranja: { flex: 1, fontSize: 16 },
  precioFranja: { fontSize: 16, fontWeight: '700' },
  borrar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  horas: { flexDirection: 'row', marginTop: espaciado.s, marginBottom: espaciado.m },
  separadorHoras: { width: espaciado.m },
});
