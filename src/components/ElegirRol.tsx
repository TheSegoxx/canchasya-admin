import React from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import type { RolElegible } from '../api/auth';
import { espaciado, radio, useTema } from '../theme/tema';
import { Icono, NombreIcono } from './Icono';

const OPCIONES: { rol: RolElegible; titulo: string; descripcion: string; icono: NombreIcono }[] = [
  {
    rol: 'jugador',
    titulo: 'Quiero reservar canchas',
    descripcion: 'Buscá complejos, reservá tu turno y organizá el partido con tus amigos.',
    icono: 'padel',
  },
  {
    rol: 'dueno',
    titulo: 'Administro un complejo',
    descripcion: 'Agenda, cobros, caja y estadísticas. Si sos encargado, después ingresás el código del dueño.',
    icono: 'complejo',
  },
];

type Props = { valor: RolElegible | null; onCambiar: (rol: RolElegible) => void };

// Las dos formas de usar la app. Al elegir una, el formulario de abajo aparece con una animación
export function ElegirRol({ valor, onCambiar }: Props) {
  const { colores } = useTema();
  const elegir = (rol: RolElegible) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onCambiar(rol);
  };

  return (
    <View accessibilityRole="radiogroup" style={estilos.grupo}>
      {OPCIONES.map(o => {
        const elegida = valor === o.rol;
        return (
          <Pressable
            key={o.rol}
            accessibilityRole="radio"
            accessibilityState={{ checked: elegida }}
            accessibilityHint={o.descripcion}
            onPress={() => elegir(o.rol)}
            style={({ pressed }) => [
              estilos.opcion,
              {
                backgroundColor: elegida ? colores.primario + '1F' : colores.superficie,
                borderColor: elegida ? colores.primario : colores.borde,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <Icono nombre={o.icono} color={elegida ? colores.primario : colores.texto} acento={colores.acento} tamano={30} />
            <View style={estilos.textos}>
              <Text style={[estilos.titulo, { color: elegida ? colores.primario : colores.texto }]}>{o.titulo}</Text>
              <Text style={[estilos.descripcion, { color: colores.textoSecundario }]}>{o.descripcion}</Text>
            </View>
            <View style={[estilos.radio, { borderColor: elegida ? colores.primario : colores.borde }]}>
              {elegida && <View style={[estilos.punto, { backgroundColor: colores.primario }]} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { marginBottom: espaciado.m },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espaciado.m,
    borderWidth: 1.5,
    borderRadius: radio,
    marginBottom: espaciado.s,
  },
  textos: { flex: 1, marginHorizontal: espaciado.m },
  titulo: { fontSize: 16, fontWeight: '700' },
  descripcion: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  punto: { width: 10, height: 10, borderRadius: 5 },
});
