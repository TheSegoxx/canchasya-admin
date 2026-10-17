import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { guardarPreferenciaTema, leerPreferenciaTema, PreferenciaTema } from '../theme/preferencia';
import { espaciado, radio, useTema } from '../theme/tema';
import { Icono, NombreIcono } from './Icono';

const TEMAS: { preferencia: PreferenciaTema; titulo: string; icono: NombreIcono }[] = [
  { preferencia: 'claro', titulo: 'Claro', icono: 'temaClaro' },
  { preferencia: 'oscuro', titulo: 'Oscuro', icono: 'temaOscuro' },
  { preferencia: 'sistema', titulo: 'Celular', icono: 'temaDispositivo' },
];

// Tema claro, oscuro o según el celular (se guarda en el celular)
export function SelectorTema() {
  const { colores } = useTema();
  const [tema, setTema] = useState<PreferenciaTema>('sistema');

  useEffect(() => {
    leerPreferenciaTema().then(setTema);
  }, []);

  const elegir = (preferencia: PreferenciaTema) => {
    setTema(preferencia);
    guardarPreferenciaTema(preferencia);
  };

  return (
    <View
      accessibilityRole="radiogroup"
      style={[estilos.selector, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      {TEMAS.map(t => {
        const elegido = tema === t.preferencia;
        return (
          <Pressable
            key={t.preferencia}
            accessibilityRole="radio"
            accessibilityState={{ checked: elegido }}
            accessibilityLabel={t.preferencia === 'sistema' ? 'Según el celular' : t.titulo}
            onPress={() => elegir(t.preferencia)}
            style={[estilos.opcion, elegido && { backgroundColor: colores.primario + '1F' }]}>
            <Icono
              nombre={t.icono}
              color={elegido ? colores.primario : colores.textoSecundario}
              acento={elegido ? colores.acento : colores.textoSecundario}
              tamano={20}
            />
            <Text style={[estilos.texto, elegido ? estilos.elegido : null, { color: elegido ? colores.primario : colores.textoSecundario }]}>
              {t.titulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    borderRadius: radio,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    marginBottom: espaciado.l,
  },
  opcion: {
    flex: 1,
    minHeight: 48,
    borderRadius: radio - 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  texto: { fontSize: 14, fontWeight: '500', marginLeft: 6 },
  elegido: { fontWeight: '600' },
});
