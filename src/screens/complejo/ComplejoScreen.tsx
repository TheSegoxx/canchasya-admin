import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { complejoApi, Servicio, SERVICIOS } from '../../api/complejo';
import { Foto, MAXIMO_FOTOS_COMPLEJO } from '../../api/fotos';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { GaleriaFotos } from '../../components/GaleriaFotos';
import { Pantalla } from '../../components/Pantalla';
import { SelectorHora } from '../../components/SelectorHora';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import { espaciado, useTema } from '../../theme/tema';
import { sumarMinutos } from '../../utils/horas';

/**
 * Datos del complejo. La primera vez que entra el dueño es obligatoria
 * (no tiene otra salida que guardar o cerrar sesión); después se edita desde "Más".
 */
export function ComplejoScreen() {
  const { colores } = useTema();
  const navigation = useNavigation();
  const { usuario, actualizarUsuario, cerrarSesion } = useSesion();
  const editando = !!usuario?.tieneComplejo;

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [apertura, setApertura] = useState('08:00');
  const [cierre, setCierre] = useState('24:00');
  const [servicios, setServicios] = useState<Servicio[]>([]);
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
      setTelefono(complejo.telefono ?? '');
      setApertura(complejo.horaApertura);
      setCierre(complejo.horaCierre);
      setServicios(complejo.servicios);
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
        telefono: telefono.trim() || null,
        horaApertura: apertura,
        horaCierre: cierre,
        servicios,
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
  seccion: { fontSize: 17, fontWeight: '700', marginTop: espaciado.s, marginBottom: espaciado.s },
  horarios: { flexDirection: 'row', marginBottom: espaciado.m },
  separadorHoras: { width: espaciado.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.m },
  error: { fontSize: 14, marginBottom: espaciado.m },
  acciones: { marginTop: espaciado.s },
  espacio: { height: espaciado.s },
});
