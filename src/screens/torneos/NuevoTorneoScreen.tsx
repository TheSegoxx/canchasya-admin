import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Deporte, NOMBRE_DEPORTE } from '../../api/canchas';
import { Formato, NOMBRE_FORMATO, torneosApi } from '../../api/torneos';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, useTema } from '../../theme/tema';

type Props = NativeStackScreenProps<RutasApp, 'NuevoTorneo'>;

const EXPLICACION: Record<Formato, string> = {
  liga: 'Todos juegan contra todos. Gana 3 puntos el que gana y 1 cada uno si empatan; al final manda la tabla.',
  eliminacion: 'El que pierde queda afuera, hasta la final. Si no son 4, 8 o 16, algunos pasan directo la primera ronda.',
};

export function NuevoTorneoScreen({ navigation }: Props) {
  const { colores } = useTema();
  const [nombre, setNombre] = useState('');
  const [deporte, setDeporte] = useState<Deporte>('futbol5');
  const [formato, setFormato] = useState<Formato>('liga');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const crear = async () => {
    if (guardando) {
      return;
    }
    if (!nombre.trim()) {
      setError('Poné un nombre (por ejemplo, "Liga de Primavera").');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const { torneo } = await torneosApi.crear({ nombre: nombre.trim(), deporte, formato });
      navigation.replace('Torneo', { id: torneo.id });
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  };

  return (
    <Pantalla>
      <CampoTexto etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Liga de Primavera" maxLength={100} />

      <Text style={[estilos.seccion, { color: colores.texto }]}>Deporte</Text>
      <View style={estilos.chips}>
        {(['futbol5', 'padel'] as Deporte[]).map(d => (
          <Chip key={d} texto={NOMBRE_DEPORTE[d]} seleccionado={deporte === d} onPress={() => setDeporte(d)} />
        ))}
      </View>

      <Text style={[estilos.seccion, { color: colores.texto }]}>Formato</Text>
      <View style={estilos.chips}>
        {(['liga', 'eliminacion'] as Formato[]).map(f => (
          <Chip key={f} texto={NOMBRE_FORMATO[f]} seleccionado={formato === f} onPress={() => setFormato(f)} />
        ))}
      </View>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>{EXPLICACION[formato]}</Text>

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo="Crear y cargar equipos" onPress={crear} cargando={guardando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  seccion: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.s },
  ayuda: { fontSize: 14, lineHeight: 20, marginBottom: espaciado.l },
  error: { fontSize: 14, marginBottom: espaciado.m },
});
