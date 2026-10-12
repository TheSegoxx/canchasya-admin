import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ImagePickerResponse, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { urlDeFoto } from '../api/cliente';
import { Foto, fotosApi } from '../api/fotos';
import { mensajeDeError } from '../context/SesionContext';
import { espaciado, radio, useTema } from '../theme/tema';
import { Icono } from './Icono';

type Props = {
  titulo: string;
  fotos: Foto[];
  maximo: number;
  // Sin canchaId son fotos del complejo
  canchaId?: number;
  onCambio: (cambio: (actuales: Foto[]) => Foto[]) => void;
};

// Antes de subirla, el celular la achica: viaja más rápido y ocupa menos en el servidor
const OPCIONES = { mediaType: 'photo', maxWidth: 1600, maxHeight: 1600, quality: 0.8 } as const;
const LADO = 96;

// Fila de fotos con botón para agregar (cámara o galería), ver en grande y borrar
export function GaleriaFotos({ titulo, fotos, maximo, canchaId, onCambio }: Props) {
  const { colores } = useTema();
  const [subiendo, setSubiendo] = useState(false);
  const [ampliada, setAmpliada] = useState<Foto | null>(null);

  const procesar = async (respuesta: ImagePickerResponse) => {
    if (respuesta.didCancel) {
      return;
    }
    const recurso = respuesta.assets?.[0];
    if (respuesta.errorCode || !recurso?.uri) {
      Alert.alert(
        'No se pudo usar la foto',
        respuesta.errorCode === 'camera_unavailable' ? 'Este celular no tiene cámara disponible.' : 'Probá de nuevo.',
      );
      return;
    }
    setSubiendo(true);
    try {
      const { foto } = await fotosApi.subir(
        { uri: recurso.uri, tipo: recurso.type ?? 'image/jpeg', nombre: recurso.fileName ?? 'foto.jpg' },
        canchaId,
      );
      onCambio(actuales => [...actuales, foto]);
    } catch (e) {
      Alert.alert('No se pudo subir la foto', mensajeDeError(e));
    } finally {
      setSubiendo(false);
    }
  };

  const agregar = () =>
    Alert.alert('Agregar foto', '¿De dónde la sacás?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Galería', onPress: () => launchImageLibrary({ ...OPCIONES, selectionLimit: 1 }).then(procesar) },
      { text: 'Cámara', onPress: () => launchCamera({ ...OPCIONES, saveToPhotos: false }).then(procesar) },
    ]);

  const borrar = (foto: Foto) =>
    Alert.alert('Borrar foto', '¿Seguro que querés borrar esta foto?', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await fotosApi.borrar(foto.id);
            onCambio(actuales => actuales.filter(f => f.id !== foto.id));
            setAmpliada(null);
          } catch (e) {
            Alert.alert('No se pudo borrar', mensajeDeError(e));
          }
        },
      },
    ]);

  return (
    <View style={estilos.contenedor}>
      <Text style={[estilos.titulo, { color: colores.texto }]}>
        {titulo} <Text style={{ color: colores.textoSecundario }}>({fotos.length} de {maximo})</Text>
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {fotos.map(foto => (
          <Pressable
            key={foto.id}
            accessibilityRole="imagebutton"
            accessibilityLabel="Ver foto"
            onPress={() => setAmpliada(foto)}
            style={estilos.miniatura}>
            <Image source={{ uri: urlDeFoto(foto.ruta) }} style={[estilos.imagen, { backgroundColor: colores.borde }]} />
          </Pressable>
        ))}
        {subiendo && (
          <View style={[estilos.miniatura, estilos.agregar, { borderColor: colores.borde }]}>
            <ActivityIndicator color={colores.primario} />
          </View>
        )}
        {!subiendo && fotos.length < maximo && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Agregar foto"
            onPress={agregar}
            style={({ pressed }) => [
              estilos.miniatura,
              estilos.agregar,
              { borderColor: colores.primario, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Icono nombre="agregar" color={colores.primario} tamano={28} />
            <Text style={[estilos.textoAgregar, { color: colores.primario }]}>Foto</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={ampliada !== null} transparent animationType="fade" onRequestClose={() => setAmpliada(null)}>
        <View style={estilos.fondoModal}>
          {ampliada && (
            <Image source={{ uri: urlDeFoto(ampliada.ruta) }} style={estilos.grande} resizeMode="contain" />
          )}
          <View style={estilos.botonesModal}>
            <Pressable accessibilityRole="button" onPress={() => ampliada && borrar(ampliada)} style={estilos.botonModal}>
              <Icono nombre="borrar" color="#FFFFFF" />
              <Text style={estilos.textoModal}>Borrar</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setAmpliada(null)} style={estilos.botonModal}>
              <Text style={estilos.textoModal}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { marginBottom: espaciado.l },
  titulo: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.s },
  miniatura: { width: LADO, height: LADO, marginRight: espaciado.s, borderRadius: radio, overflow: 'hidden' },
  imagen: { width: LADO, height: LADO },
  agregar: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  textoAgregar: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  grande: { width: '100%', height: '75%' },
  botonesModal: { flexDirection: 'row', justifyContent: 'space-around', marginTop: espaciado.l },
  botonModal: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: espaciado.l },
  textoModal: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginLeft: espaciado.xs },
});
