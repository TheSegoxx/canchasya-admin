import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { HoraClima, jugadorApi } from '../../api/jugador';
import { espaciado, radio, useTema } from '../../theme/tema';
import { climaDelTurno, LLUVIA_PARA_AVISAR } from '../../utils/clima';

type Props = {
  complejoId: number;
  fecha: string;
  inicio: string;
  fin: string;
  techada: boolean;
};

// El pronóstico mientras se juega. Si no hay (sin ubicación, falta mucho, sin conexión) no se muestra nada.
export function TarjetaClima({ complejoId, fecha, inicio, fin, techada }: Props) {
  const { colores } = useTema();
  const [horas, setHoras] = useState<HoraClima[]>([]);

  useEffect(() => {
    let vigente = true;
    setHoras([]);
    jugadorApi
      .clima(complejoId, fecha)
      .then(r => vigente && setHoras(r.horas))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [complejoId, fecha]);

  const clima = climaDelTurno(horas, inicio, fin);
  if (!clima) {
    return null;
  }
  const llueve = clima.lluvia >= LLUVIA_PARA_AVISAR;
  return (
    <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: llueve && !techada ? colores.senado : colores.borde }]}>
      <Text style={estilos.emoji}>{clima.emoji}</Text>
      <View style={estilos.datos}>
        <Text style={[estilos.titulo, { color: colores.texto }]}>
          {clima.texto} · {clima.temperatura}°
        </Text>
        <Text style={[estilos.detalle, { color: llueve && !techada ? colores.senado : colores.textoSecundario }]}>
          {clima.lluvia}% de probabilidad de lluvia
          {llueve ? (techada ? ' · La cancha es techada' : ' · Ojo: la cancha es al aire libre') : ''}
        </Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radio,
    padding: espaciado.m,
    marginBottom: espaciado.m,
  },
  emoji: { fontSize: 30 },
  datos: { flex: 1, marginLeft: espaciado.m },
  titulo: { fontSize: 16, fontWeight: '700' },
  detalle: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
