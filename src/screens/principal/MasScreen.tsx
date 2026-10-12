import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Boton } from '../../components/Boton';
import { Pantalla } from '../../components/Pantalla';
import { useSesion } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';

export function MasScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const { usuario, cerrarSesion } = useSesion();
  const [saliendo, setSaliendo] = useState(false);

  const confirmarSalida = () =>
    Alert.alert('Cerrar sesión', '¿Querés salir de tu cuenta en este celular?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          setSaliendo(true);
          await cerrarSesion();
        },
      },
    ]);

  if (!usuario) {
    return null;
  }

  return (
    <Pantalla>
      <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        {usuario.foto ? (
          <Image source={{ uri: usuario.foto }} style={estilos.foto} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[estilos.foto, estilos.inicial, { backgroundColor: colores.primario }]}>
            <Text style={[estilos.letra, { color: colores.textoSobrePrimario }]}>
              {usuario.nombre.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={estilos.datos}>
          <Text style={[estilos.nombre, { color: colores.texto }]}>{usuario.nombre}</Text>
          <Text style={[estilos.email, { color: colores.textoSecundario }]}>{usuario.email}</Text>
        </View>
      </View>

      <Boton titulo="Datos del complejo" variante="secundario" onPress={() => navigation.navigate('Complejo')} />
      <View style={estilos.espacio} />
      <Boton titulo="Turnos fijos" icono="repetir" variante="secundario" onPress={() => navigation.navigate('TurnosFijos')} />
      <View style={estilos.espacio} />
      <Boton titulo="Clientes" icono="persona" variante="secundario" onPress={() => navigation.navigate('Clientes')} />
      <View style={estilos.espacio} />
      <Boton titulo="Productos y extras" variante="secundario" onPress={() => navigation.navigate('Productos')} />
      <View style={estilos.espacio} />
      <Boton titulo="Cerrar sesión" variante="texto" onPress={confirmarSalida} cargando={saliendo} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    marginBottom: espaciado.l,
  },
  foto: { width: 56, height: 56, borderRadius: 28 },
  inicial: { alignItems: 'center', justifyContent: 'center' },
  letra: { fontSize: 24, fontWeight: '700' },
  datos: { flex: 1, marginLeft: espaciado.m },
  nombre: { fontSize: 18, fontWeight: '700' },
  email: { fontSize: 14, marginTop: 2 },
  espacio: { height: espaciado.s },
});
