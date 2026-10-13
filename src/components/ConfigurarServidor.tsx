import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Boton } from './Boton';
import { CampoTexto } from './CampoTexto';
import { Pantalla } from './Pantalla';
import { Text } from './Texto';
import { guardarServidor, normalizarServidor, probarServidor, SERVIDOR_POR_DEFECTO, servidorActual } from '../servidor';
import { espaciado, useTema } from '../theme/tema';

type Props = {
  // Se llama después de guardar una dirección que respondió
  alGuardar: () => void;
  // Opcional: botón para volver sin cambiar nada
  alCancelar?: () => void;
};

// Dirección del servidor (la computadora con XAMPP): se prueba antes de guardarla
export function ConfigurarServidor({ alGuardar, alCancelar }: Props) {
  const { colores } = useTema();
  const [texto, setTexto] = useState(servidorActual());
  const [estado, setEstado] = useState<{ error: boolean; mensaje: string } | null>(null);
  const [probando, setProbando] = useState(false);

  const guardar = async () => {
    if (probando) {
      return;
    }
    const direccion = normalizarServidor(texto);
    if (!direccion) {
      setEstado({ error: true, mensaje: 'Escribí la IP de la computadora, por ejemplo 192.168.1.7.' });
      return;
    }
    setTexto(direccion);
    setProbando(true);
    setEstado(null);
    const responde = await probarServidor(direccion);
    setProbando(false);
    if (!responde) {
      setEstado({
        error: true,
        mensaje:
          'No respondió. Revisá que XAMPP esté encendido, que el celular esté en el mismo WiFi y que la IP sea la correcta.',
      });
      return;
    }
    await guardarServidor(direccion);
    alGuardar();
  };

  return (
    <Pantalla>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        La app se conecta con la computadora donde está XAMPP, por el mismo WiFi. Su IP se ve en Windows con el
        comando <Text style={[estilos.codigo, { color: colores.texto }]}>ipconfig</Text> (Dirección IPv4).
      </Text>
      <CampoTexto
        etiqueta="Dirección del servidor"
        value={texto}
        onChangeText={setTexto}
        placeholder="192.168.1.7"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={guardar}
      />
      {!!estado && (
        <Text
          accessibilityLiveRegion="polite"
          style={[estilos.mensaje, { color: estado.error ? colores.error : colores.primario }]}>
          {estado.mensaje}
        </Text>
      )}
      <Boton titulo="Probar y guardar" onPress={guardar} cargando={probando} />
      <View style={estilos.espacio} />
      <Boton
        titulo="Usar la de fábrica"
        variante="texto"
        onPress={() => {
          setTexto(SERVIDOR_POR_DEFECTO);
          setEstado(null);
        }}
        deshabilitado={probando}
      />
      {alCancelar && <Boton titulo="Volver" variante="texto" onPress={alCancelar} deshabilitado={probando} />}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  ayuda: { fontSize: 15, lineHeight: 21, marginBottom: espaciado.l },
  codigo: { fontWeight: '600' },
  mensaje: { fontSize: 14, marginBottom: espaciado.m },
  espacio: { height: espaciado.s },
});
