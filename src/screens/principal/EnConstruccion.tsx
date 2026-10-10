import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Pantalla } from '../../components/Pantalla';
import { espaciado, useTema } from '../../theme/tema';

type Props = { titulo: string; descripcion: string };

// Lugar reservado para las secciones que se programan en los próximos días del plan
export function EnConstruccion({ titulo, descripcion }: Props) {
  const { colores } = useTema();
  return (
    <Pantalla centrado>
      <Text style={[estilos.titulo, { color: colores.texto }]}>{titulo}</Text>
      <Text style={[estilos.texto, { color: colores.textoSecundario }]}>{descripcion}</Text>
    </Pantalla>
  );
}

export const InicioScreen = () => (
  <EnConstruccion titulo="Ingresos" descripcion="Acá vas a ver lo cobrado hoy, en la semana y en el mes." />
);

export const AgendaScreen = () => (
  <EnConstruccion titulo="Agenda" descripcion="Acá vas a ver y cargar los turnos de cada cancha." />
);

export const CanchasScreen = () => (
  <EnConstruccion titulo="Canchas" descripcion="Acá vas a publicar tus canchas de pádel y fútbol 5." />
);

const estilos = StyleSheet.create({
  titulo: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  texto: { fontSize: 16, textAlign: 'center', marginTop: espaciado.s },
});
