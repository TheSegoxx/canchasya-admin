import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { complejoApi, Servicio, SERVICIOS, Ubicacion } from '../../api/complejo';
import { Foto, MAXIMO_FOTOS_COMPLEJO } from '../../api/fotos';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { FilaInterruptor } from '../../components/FilaInterruptor';
import { GaleriaFotos } from '../../components/GaleriaFotos';
import { Icono } from '../../components/Icono';
import { Pantalla } from '../../components/Pantalla';
import { SelectorHora } from '../../components/SelectorHora';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { ubicacionActual } from '../../ubicacion';
import { abrirMapa } from '../../utils/acciones';
import { sumarMinutos } from '../../utils/horas';

/**
 * Datos del complejo. La primera vez que entra el dueño es obligatoria
 * (no tiene otra salida que guardar o cerrar sesión); después se edita desde "Más".
 */
export function ComplejoScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const { usuario, actualizarUsuario, cerrarSesion } = useSesion();
  const editando = !!usuario?.tieneComplejo;

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  // Lo que encontró el buscador (para que el dueño confirme que es ahí)
  const [encontrada, setEncontrada] = useState('');
  const [ubicando, setUbicando] = useState<'direccion' | 'gps' | null>(null);
  const [telefono, setTelefono] = useState('');
  const [apertura, setApertura] = useState('08:00');
  const [cierre, setCierre] = useState('24:00');
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [visible, setVisible] = useState(true);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [cargando, setCargando] = useState(editando);
  const [errorCarga, setErrorCarga] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Al editar, se completan los campos con lo que ya está guardado
  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const { complejo, fotos: guardadas } = await complejoApi.obtener();
      setFotos(guardadas);
      setNombre(complejo.nombre);
      setDireccion(complejo.direccion);
      setCiudad(complejo.ciudad ?? '');
      setUbicacion(complejo.ubicacion);
      setTelefono(complejo.telefono ?? '');
      setApertura(complejo.horaApertura);
      setCierre(complejo.horaCierre);
      setServicios(complejo.servicios);
      setVisible(complejo.visible);
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (editando) {
      cargar();
    }
  }, [editando, cargar]);

  const alternarServicio = (clave: Servicio) =>
    setServicios(actuales =>
      actuales.includes(clave) ? actuales.filter(s => s !== clave) : [...actuales, clave],
    );

  const buscarPorDireccion = async () => {
    const texto = [direccion.trim(), ciudad.trim()].filter(Boolean).join(', ');
    if (texto.length < 5) {
      Alert.alert('Falta la dirección', 'Escribí la dirección y la ciudad del complejo.');
      return;
    }
    setUbicando('direccion');
    try {
      const { latitud, longitud, encontrada: lugar } = await complejoApi.buscarUbicacion(texto);
      setUbicacion({ latitud, longitud });
      setEncontrada(lugar);
    } catch (e) {
      Alert.alert('No se encontró', mensajeDeError(e));
    } finally {
      setUbicando(null);
    }
  };

  const usarGps = async () => {
    setUbicando('gps');
    try {
      setUbicacion(await ubicacionActual());
      setEncontrada('');
    } catch (e) {
      Alert.alert('Ubicación actual', e instanceof Error ? e.message : 'No se pudo obtener la ubicación.');
    } finally {
      setUbicando(null);
    }
  };

  const guardar = async () => {
    if (guardando) {
      return;
    }
    if (!nombre.trim() || !direccion.trim()) {
      setError('Completá el nombre y la dirección del complejo.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await complejoApi.guardar({
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        ciudad: ciudad.trim() || null,
        ubicacion,
        telefono: telefono.trim() || null,
        horaApertura: apertura,
        horaCierre: cierre,
        servicios,
        visible,
      });
      if (editando) {
        setGuardando(false);
        Alert.alert('Listo', 'Los datos del complejo se guardaron.');
        navigation.goBack();
      } else if (usuario) {
        // Con el complejo creado, la navegación pasa sola a la app
        actualizarUsuario({ ...usuario, tieneComplejo: true });
      }
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  if (errorCarga) {
    return <ErrorCarga mensaje={errorCarga} onReintentar={cargar} />;
  }

  return (
    <Pantalla>
      {!editando && (
        <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
          ¡Hola{usuario ? `, ${usuario.nombre.split(' ')[0]}` : ''}! Antes de cargar canchas, contanos
          cómo es tu complejo. Después lo podés cambiar desde "Más".
        </Text>
      )}
      {!editando && (
        <View style={estilos.unirse}>
          <Boton
            titulo="Soy encargado: tengo un código"
            variante="secundario"
            onPress={() => navigation.navigate('Unirse')}
            deshabilitado={guardando}
          />
        </View>
      )}

      {/* Las fotos se suben al momento; necesitan que el complejo ya exista */}
      {editando && (
        <GaleriaFotos titulo="Fotos del complejo" fotos={fotos} maximo={MAXIMO_FOTOS_COMPLEJO} onCambio={setFotos} />
      )}

      <CampoTexto etiqueta="Nombre del complejo" value={nombre} onChangeText={setNombre} maxLength={150} />
      <CampoTexto
        etiqueta="Dirección"
        value={direccion}
        onChangeText={setDireccion}
        maxLength={150}
        autoComplete="street-address"
      />
      <CampoTexto etiqueta="Ciudad o localidad" value={ciudad} onChangeText={setCiudad} maxLength={80} placeholder="Por ejemplo, Rosario" />

      <Text style={[estilos.seccion, { color: colores.texto }]}>Ubicación en el mapa</Text>
      <Text style={[estilos.ayudaChica, { color: colores.textoSecundario }]}>
        Con la ubicación, el mensaje de confirmación por WhatsApp lleva el link "Cómo llegar".
      </Text>
      {ubicacion && (
        <View style={[estilos.ubicacion, { backgroundColor: colores.superficie, borderColor: colores.primario }]}>
          <Icono nombre="ubicacion" color={colores.texto} acento={colores.primario} />
          <View style={estilos.datosUbicacion}>
            <Text style={[estilos.tituloUbicacion, { color: colores.texto }]}>Ubicación cargada</Text>
            <Text numberOfLines={2} style={[estilos.ayudaChica, estilos.sinMargen, { color: colores.textoSecundario }]}>
              {encontrada || `${ubicacion.latitud}, ${ubicacion.longitud}`}
            </Text>
          </View>
        </View>
      )}
      {ubicacion && (
        <View style={estilos.filaBotones}>
          <View style={estilos.flex}>
            <Boton titulo="Ver en el mapa" icono="ubicacion" variante="secundario" onPress={() => abrirMapa(ubicacion)} />
          </View>
          <View style={estilos.separadorHoras} />
          <Boton
            titulo="Quitar"
            variante="texto"
            color={colores.error}
            onPress={() => {
              setUbicacion(null);
              setEncontrada('');
            }}
          />
        </View>
      )}
      <Boton
        titulo={ubicacion ? 'Buscar de nuevo con la dirección' : 'Buscar con la dirección'}
        icono="ubicacion"
        variante="secundario"
        onPress={buscarPorDireccion}
        cargando={ubicando === 'direccion'}
        deshabilitado={ubicando !== null}
      />
      <View style={estilos.espacio} />
      <Boton
        titulo="Usar mi ubicación actual"
        icono="miUbicacion"
        variante="secundario"
        onPress={usarGps}
        cargando={ubicando === 'gps'}
        deshabilitado={ubicando !== null}
      />
      <Text style={[estilos.ayudaChica, { color: colores.textoSecundario }]}>
        Si estás en el complejo, es lo más preciso. Después tocá "Ver en el mapa" para revisar que esté bien.
      </Text>
      <CampoTexto
        etiqueta="Teléfono (opcional)"
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={30}
      />

      <Text style={[estilos.seccion, { color: colores.texto }]}>Horario de atención</Text>
      <View style={estilos.horarios}>
        <SelectorHora
          etiqueta="Abre"
          valor={apertura}
          onCambiar={setApertura}
          maximo={sumarMinutos(cierre, -30)}
        />
        <View style={estilos.separadorHoras} />
        <SelectorHora etiqueta="Cierra" valor={cierre} onCambiar={setCierre} minimo={sumarMinutos(apertura, 30)} />
      </View>

      <Text style={[estilos.seccion, { color: colores.texto }]}>Servicios</Text>
      <View style={estilos.chips}>
        {SERVICIOS.map(s => (
          <Chip
            key={s.clave}
            texto={s.nombre}
            seleccionado={servicios.includes(s.clave)}
            onPress={() => alternarServicio(s.clave)}
          />
        ))}
      </View>

      <FilaInterruptor
        titulo="Mostrar mi complejo en CanchasYa"
        descripcion={visible ? 'Los jugadores lo encuentran al buscar dónde jugar' : 'Los jugadores no lo ven en la búsqueda'}
        valor={visible}
        onCambiar={setVisible}
      />

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}

      <View style={estilos.acciones}>
        <Boton titulo={editando ? 'Guardar cambios' : 'Guardar y empezar'} onPress={guardar} cargando={guardando} />
        {!editando && (
          <>
            <View style={estilos.espacio} />
            <Boton titulo="Salir de esta cuenta" variante="texto" onPress={cerrarSesion} deshabilitado={guardando} />
          </>
        )}
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ayuda: { fontSize: 15, lineHeight: 21, marginBottom: espaciado.l },
  ayudaChica: { fontSize: 14, lineHeight: 20, marginBottom: espaciado.m },
  sinMargen: { marginBottom: 0 },
  ubicacion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espaciado.m,
    borderWidth: 1.5,
    borderRadius: radio,
    marginBottom: espaciado.s,
  },
  datosUbicacion: { flex: 1, marginLeft: espaciado.m },
  tituloUbicacion: { fontSize: 16, fontWeight: '700' },
  filaBotones: { flexDirection: 'row', alignItems: 'center', marginBottom: espaciado.s },
  flex: { flex: 1 },
  seccion: { fontSize: 17, fontWeight: '700', marginTop: espaciado.s, marginBottom: espaciado.s },
  horarios: { flexDirection: 'row', marginBottom: espaciado.m },
  separadorHoras: { width: espaciado.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.m },
  error: { fontSize: 14, marginBottom: espaciado.m },
  acciones: { marginTop: espaciado.s },
  espacio: { height: espaciado.s },
  unirse: { marginBottom: espaciado.l },
});
