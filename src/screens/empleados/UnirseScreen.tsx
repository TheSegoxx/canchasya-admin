import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '../../components/Texto';
import { empleadosApi } from '../../api/empleados';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import { espaciado, useTema } from '../../theme/tema';

// El encargado escribe el código que le pasó el dueño y queda unido a su complejo
export function UnirseScreen() {
  const { colores } = useTema();
  const { actualizarUsuario } = useSesion();
  const [codigo, setCodigo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const unirse = async () => {
    if (guardando) {
      return;
    }
    if (codigo.replace(/[^A-Za-z0-9]/g, '').length !== 8) {
      setError('El código tiene 8 letras y números (por ejemplo, ABCD-2345).');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const { usuario } = await empleadosApi.aceptar(codigo);
      // Con el complejo asignado, la navegación pasa sola a la app
      actualizarUsuario(usuario);
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  };

  return (
    <Pantalla>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        Si trabajás en un complejo que ya usa CanchasYa, pedile al dueño un código de invitación (lo genera en
        Más → Empleados) y escribilo acá.
      </Text>
      <CampoTexto
        etiqueta="Código de invitación"
        value={codigo}
        onChangeText={texto => setCodigo(texto.toUpperCase())}
        placeholder="ABCD-2345"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        style={estilos.codigo}
      />
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo="Unirme al complejo" onPress={unirse} cargando={guardando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  ayuda: { fontSize: 15, lineHeight: 21, marginBottom: espaciado.l },
  codigo: { fontSize: 22, letterSpacing: 3, textAlign: 'center' },
  error: { fontSize: 14, marginBottom: espaciado.m },
});
