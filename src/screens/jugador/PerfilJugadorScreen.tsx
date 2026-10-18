import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NOMBRE_DEPORTE } from '../../api/canchas';
import { jugadorApi, TarjetaFidelidad } from '../../api/jugador';
import { Pantalla } from '../../components/Pantalla';
import { SelectorTema } from '../../components/SelectorTema';
import { TarjetaCuenta } from '../../components/TarjetaCuenta';
import { useSesion } from '../../context/SesionContext';
import type { RutasJugador } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { formatearTelefono } from '../../utils/telefono';
import { BotonCerrarSesion, ListaOpciones } from '../principal/MasScreen';
import { TarjetaSellos } from './TarjetaSellos';

// Pestaña "Perfil" del jugador: sus datos, el tema y cerrar sesión
export function PerfilJugadorScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasJugador>>();
  const { usuario } = useSesion();
  const [tarjetas, setTarjetas] = useState<TarjetaFidelidad[]>([]);

  // Los sellos se actualizan al volver a la pestaña (pudo haber jugado un turno)
  useFocusEffect(
    useCallback(() => {
      jugadorApi
        .tarjetas()
        .then(r => setTarjetas(r.tarjetas))
        .catch(() => undefined);
    }, []),
  );

  if (!usuario) {
    return null;
  }

  const fila = (etiqueta: string, valor: string, ultima = false) => (
    <View style={[estilos.fila, !ultima && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colores.borde }]}>
      <Text style={[estilos.etiqueta, { color: colores.textoSecundario }]}>{etiqueta}</Text>
      <Text style={[estilos.valor, { color: colores.texto }]}>{valor}</Text>
    </View>
  );

  return (
    <Pantalla>
      <TarjetaCuenta usuario={usuario} detalle={usuario.ciudad ? `Jugador · ${usuario.ciudad}` : 'Jugador'} />

      <View style={[estilos.datos, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        {fila('Celular', usuario.telefono ? formatearTelefono(usuario.telefono) : 'Sin cargar')}
        {fila('Juega', usuario.deportes.length > 0 ? usuario.deportes.map(d => NOMBRE_DEPORTE[d]).join(' y ') : 'Sin elegir', true)}
      </View>

      {tarjetas.length > 0 && (
        <>
          <Text style={[estilos.seccion, { color: colores.textoSecundario }]}>Mis sellos</Text>
          {tarjetas.map(t => (
            <TarjetaSellos key={t.complejoId} fidelidad={t} titulo={t.complejo} />
          ))}
        </>
      )}

      <Text style={[estilos.seccion, { color: colores.textoSecundario }]}>Cuenta</Text>
      <ListaOpciones
        opciones={[{ titulo: 'Mis datos', icono: 'persona', ruta: 'MisDatos' as const }]}
        onElegir={ruta => navigation.navigate(ruta)}
      />

      <Text style={[estilos.seccion, { color: colores.textoSecundario }]}>Tema</Text>
      <SelectorTema />

      <BotonCerrarSesion />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  datos: {
    borderRadius: radio,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: espaciado.m,
    marginBottom: espaciado.l,
  },
  fila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  etiqueta: { fontSize: 15 },
  valor: { fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: espaciado.m },
  seccion: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: espaciado.s,
    marginLeft: espaciado.xs,
  },
});
