import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Text } from '../../components/Texto';
import { useNavigation } from '@react-navigation/native';
import { authApi } from '../../api/auth';
import { Boton } from '../../components/Boton';
import { DatosPersonales, Perfil, perfilParaApi, validarPerfil } from '../../components/DatosPersonales';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import { espaciado, useTema } from '../../theme/tema';
import { formatearTelefono } from '../../utils/telefono';

// Editar los datos personales de la cuenta (jugador, dueño o encargado). El email y el tipo de cuenta no se cambian
export function MisDatosScreen() {
  const { colores } = useTema();
  const navigation = useNavigation();
  const { usuario, actualizarUsuario } = useSesion();
  const [perfil, setPerfil] = useState<Perfil>({
    nombre: usuario?.nombre ?? '',
    telefono: usuario?.telefono ? formatearTelefono(usuario.telefono) : '',
    ciudad: usuario?.ciudad ?? '',
    deportes: usuario?.deportes ?? [],
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  if (!usuario) {
    return null;
  }

  const guardar = async () => {
    if (guardando) {
      return;
    }
    const problema = validarPerfil(perfil);
    setError(problema);
    if (problema) {
      return;
    }
    setGuardando(true);
    try {
      const respuesta = await authApi.guardarPerfil(perfilParaApi(perfil, usuario.rol));
      actualizarUsuario(respuesta.usuario);
      Alert.alert('Listo', 'Tus datos se guardaron.');
      navigation.goBack();
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  };

  return (
    <Pantalla>
      <Text style={[estilos.email, { color: colores.textoSecundario }]}>{usuario.email}</Text>
      <DatosPersonales rol={usuario.rol} valor={perfil} onCambiar={setPerfil} />
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  email: { fontSize: 15, marginBottom: espaciado.l },
  error: { fontSize: 14, marginBottom: espaciado.m },
});
