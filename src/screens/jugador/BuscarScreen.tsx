import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '../../components/Texto';
import { Pantalla } from '../../components/Pantalla';
import { Proximamente } from '../../components/Proximamente';
import { useSesion } from '../../context/SesionContext';
import { espaciado, useTema } from '../../theme/tema';

// Pestaña "Buscar" del jugador: complejos, horarios libres y reserva (próximo paso)
export function BuscarScreen() {
  const { colores } = useTema();
  const { usuario } = useSesion();
  return (
    <Pantalla>
      <Text style={[estilos.hola, { color: colores.texto }]}>
        ¡Hola{usuario ? `, ${usuario.nombre.split(' ')[0]}` : ''}!
      </Text>
      <Text style={[estilos.pregunta, { color: colores.textoSecundario }]}>¿Dónde jugás hoy?</Text>
      <Proximamente
        icono="buscar"
        titulo="Buscá dónde jugar"
        texto="Vas a poder ver los complejos cerca, sus horarios libres y precios, y reservar tu cancha eligiendo cuántas horas jugás."
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  hola: { fontSize: 26, fontWeight: '700' },
  pregunta: { fontSize: 16, marginBottom: espaciado.l },
});
