import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { Fidelidad } from '../../api/jugador';
import { espaciado, radio, useTema } from '../../theme/tema';

// "Turno gratis" o "50 % de descuento"
export const textoPremio = (descuento: number) => (descuento >= 100 ? 'un turno gratis' : `${descuento} % de descuento en un turno`);

// La tarjeta de sellos del programa de fidelidad de un complejo
export function TarjetaSellos({ fidelidad, titulo }: { fidelidad: Fidelidad; titulo?: string }) {
  const { colores } = useTema();
  const { turnos, sellos, premios, descuento } = fidelidad;
  return (
    <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: premios > 0 ? colores.primario : colores.borde }]}>
      <Text style={[estilos.titulo, { color: colores.texto }]}>{titulo ?? 'Programa de fidelidad'}</Text>
      <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
        Cada {turnos} turnos que juegues reservando por la app, {textoPremio(descuento)}.
      </Text>
      <View style={estilos.sellos} accessibilityLabel={`${sellos} de ${turnos} sellos`}>
        {Array.from({ length: turnos }, (_, i) => (
          <View
            key={i}
            style={[
              estilos.sello,
              i < sellos
                ? { backgroundColor: colores.primario, borderColor: colores.primario }
                : { borderColor: colores.borde },
            ]}>
            {i < sellos && <Text style={[estilos.tilde, { color: colores.textoSobrePrimario }]}>✓</Text>}
          </View>
        ))}
      </View>
      <Text style={[estilos.cuenta, { color: premios > 0 ? colores.primario : colores.texto }]}>
        {premios > 0
          ? `🎁 Tenés ${premios === 1 ? 'un premio' : `${premios} premios`} para usar al reservar`
          : `${sellos} de ${turnos} · te ${turnos - sellos === 1 ? 'falta 1 turno' : `faltan ${turnos - sellos} turnos`}`}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: radio, padding: espaciado.m, marginBottom: espaciado.m },
  titulo: { fontSize: 16, fontWeight: '700' },
  detalle: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  sellos: { flexDirection: 'row', flexWrap: 'wrap', marginTop: espaciado.s },
  sello: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginBottom: 6,
  },
  tilde: { fontSize: 13, fontWeight: '700' },
  cuenta: { fontSize: 14, fontWeight: '600', marginTop: espaciado.xs },
});
