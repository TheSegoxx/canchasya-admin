import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { agendaApi } from '../../api/agenda';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, useTema } from '../../theme/tema';
import { abrirWhatsApp, llamar } from '../../utils/acciones';
import { formatearTelefono } from '../../utils/telefono';

type Props = NativeStackScreenProps<RutasApp, 'Cliente'>;

// Corregir el nombre o el celular de un cliente
export function ClienteScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const { cliente } = route.params;
  const [nombre, setNombre] = useState(cliente.nombre);
  const [telefono, setTelefono] = useState(formatearTelefono(cliente.telefono));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    if (guardando) {
      return;
    }
    if (!nombre.trim() || telefono.replace(/\D/g, '').length < 8) {
      setError('Completá el nombre y el celular con código de área.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await agendaApi.editarCliente(cliente.id, { nombre: nombre.trim(), telefono });
      navigation.goBack();
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  };

  return (
    <Pantalla>
      <CampoTexto etiqueta="Nombre" value={nombre} onChangeText={setNombre} maxLength={100} />
      <CampoTexto
        etiqueta="Celular con código de área"
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
        maxLength={30}
      />
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo="Guardar cambios" onPress={guardar} cargando={guardando} />

      <View style={estilos.acciones}>
        <Boton
          titulo="WhatsApp"
          icono="whatsapp"
          variante="secundario"
          color={colores.whatsapp}
          onPress={() => abrirWhatsApp(cliente.telefono, `Hola ${cliente.nombre.split(' ')[0]}!`)}
        />
        <View style={estilos.espacio} />
        <Boton titulo="Llamar" icono="telefono" variante="secundario" onPress={() => llamar(cliente.telefono)} />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  error: { fontSize: 14, marginBottom: espaciado.m },
  acciones: { marginTop: espaciado.xl },
  espacio: { height: espaciado.s },
});
