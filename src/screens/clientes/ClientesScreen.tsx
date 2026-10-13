import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { agendaApi, Cliente } from '../../api/agenda';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Icono } from '../../components/Icono';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { abrirWhatsApp } from '../../utils/acciones';
import { formatearTelefono } from '../../utils/telefono';

// Clientes del complejo: se cargan solos al reservarles un turno; acá se buscan y corrigen
export function ClientesScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const [busqueda, setBusqueda] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  // Cambia al volver de editar un cliente, para releer la lista
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setVersion(v => v + 1);
    }, []),
  );

  useEffect(() => {
    let vigente = true;
    const espera = setTimeout(async () => {
      try {
        const respuesta = await agendaApi.buscarClientes(busqueda.trim());
        if (vigente) {
          setClientes(respuesta.clientes);
          setError('');
        }
      } catch (e) {
        if (vigente) {
          setError(mensajeDeError(e));
        }
      } finally {
        if (vigente) {
          setCargando(false);
        }
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [busqueda, version]);

  const fila = ({ item }: { item: Cliente }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Abre el cliente para corregir sus datos"
      onPress={() => navigation.navigate('Cliente', { cliente: item })}
      style={({ pressed }) => [
        estilos.fila,
        { backgroundColor: colores.superficie, borderColor: colores.borde, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={estilos.datos}>
        <Text style={[estilos.nombre, { color: colores.texto }]}>{item.nombre}</Text>
        <Text style={[estilos.telefono, { color: colores.textoSecundario }]}>{formatearTelefono(item.telefono)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Escribirle por WhatsApp a ${item.nombre}`}
        onPress={() => abrirWhatsApp(item.telefono, `Hola ${item.nombre.split(' ')[0]}!`)}
        hitSlop={6}
        style={estilos.whatsapp}>
        <Icono nombre="whatsapp" color={colores.whatsapp} tamano={26} />
      </Pressable>
    </Pressable>
  );

  return (
    <View style={[estilos.pantalla, { backgroundColor: colores.fondo }]}>
      <View style={estilos.buscador}>
        <CampoTexto
          etiqueta="Buscar"
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Nombre o teléfono"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={clientes}
        keyExtractor={c => String(c.id)}
        renderItem={fila}
        contentContainerStyle={estilos.lista}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          cargando ? undefined : error ? (
            <View>
              <Text style={[estilos.vacio, { color: colores.error }]}>{error}</Text>
              <Boton titulo="Reintentar" variante="secundario" onPress={() => setVersion(v => v + 1)} />
            </View>
          ) : (
            <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>
              {busqueda.trim()
                ? 'No hay clientes que coincidan.'
                : 'Todavía no hay clientes. Se agregan solos cuando les reservás un turno.'}
            </Text>
          )
        }
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  buscador: { paddingHorizontal: espaciado.m, paddingTop: espaciado.m },
  lista: { paddingHorizontal: espaciado.m, paddingBottom: espaciado.l },
  vacio: { fontSize: 15, textAlign: 'center', paddingVertical: espaciado.xl, lineHeight: 21 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingLeft: espaciado.m,
    borderRadius: radio,
    borderWidth: 1,
    marginBottom: espaciado.s,
  },
  datos: { flex: 1 },
  nombre: { fontSize: 16, fontWeight: '700' },
  telefono: { fontSize: 14, marginTop: 2 },
  whatsapp: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
