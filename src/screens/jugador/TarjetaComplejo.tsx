import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { urlDeFoto } from '../../api/cliente';
import { NOMBRE_DEPORTE } from '../../api/canchas';
import { ComplejoResumen, textoDistancia } from '../../api/explorar';
import { Icono } from '../../components/Icono';
import { espaciado, radio, useTema } from '../../theme/tema';
import { formatearPesos } from '../../utils/formato';

type Props = {
  complejo: ComplejoResumen;
  onPress: () => void;
  onFavorito: () => void;
};

// Un complejo en la lista de búsqueda: foto, nombre, dónde queda, deportes y desde cuánto sale
export function TarjetaComplejo({ complejo, onPress, onFavorito }: Props) {
  const { colores } = useTema();
  const lugar = [complejo.direccion, complejo.ciudad].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${complejo.nombre}, ${lugar}`}
      accessibilityHint="Abre la ficha del complejo"
      onPress={onPress}
      style={({ pressed }) => [
        estilos.tarjeta,
        { backgroundColor: colores.superficie, borderColor: colores.borde, opacity: pressed ? 0.9 : 1 },
      ]}>
      {complejo.foto ? (
        <Image source={{ uri: urlDeFoto(complejo.foto) }} style={[estilos.foto, { backgroundColor: colores.borde }]} />
      ) : (
        <View style={[estilos.foto, estilos.sinFoto, { backgroundColor: colores.primario + '14' }]}>
          <Icono nombre="canchas" color={colores.primario} acento={colores.acento} tamano={44} />
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={complejo.favorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        onPress={onFavorito}
        hitSlop={8}
        style={[estilos.corazon, { backgroundColor: colores.fondo + 'D9' }]}>
        <Icono
          nombre={complejo.favorito ? 'favoritoLleno' : 'favorito'}
          color={complejo.favorito ? colores.error : colores.texto}
          acento={colores.error}
          tamano={22}
        />
      </Pressable>

      <View style={estilos.datos}>
        <Text style={[estilos.nombre, { color: colores.texto }]} numberOfLines={1}>
          {complejo.nombre}
        </Text>
        <Text style={[estilos.lugar, { color: colores.textoSecundario }]} numberOfLines={1}>
          {lugar}
          {complejo.distanciaKm !== null ? ` · ${textoDistancia(complejo.distanciaKm)}` : ''}
        </Text>
        <View style={estilos.fila}>
          {complejo.deportes.map(d => (
            <View key={d} style={[estilos.deporte, { borderColor: colores.borde }]}>
              <Icono nombre={d} color={colores.primario} tamano={15} />
              <Text style={[estilos.textoDeporte, { color: colores.texto }]}>{NOMBRE_DEPORTE[d]}</Text>
            </View>
          ))}
          <Text style={[estilos.canchas, { color: colores.textoSecundario }]}>
            {complejo.canchas === 1 ? '1 cancha' : `${complejo.canchas} canchas`}
          </Text>
        </View>
        <Text style={[estilos.precio, { color: colores.texto }]}>
          Desde <Text style={[estilos.monto, { color: colores.primario }]}>{formatearPesos(complejo.precioHoraDesde)}</Text> la
          hora
        </Text>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { borderRadius: radio, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: espaciado.m },
  foto: { width: '100%', aspectRatio: 2.2 },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  corazon: {
    position: 'absolute',
    top: espaciado.s,
    right: espaciado.s,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datos: { padding: espaciado.m },
  nombre: { fontSize: 17, fontWeight: '700' },
  lugar: { fontSize: 14, marginTop: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: espaciado.s },
  deporte: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  textoDeporte: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  canchas: { fontSize: 13 },
  precio: { fontSize: 14, marginTop: espaciado.s },
  monto: { fontWeight: '700' },
});
