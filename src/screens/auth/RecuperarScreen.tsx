import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '../../components/Texto';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi } from '../../api/auth';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasAuth } from '../../navigation/AppNavigator';
import { espaciado, useTema } from '../../theme/tema';

type Props = NativeStackScreenProps<RutasAuth, 'Recuperar'>;

// Paso 1 de "¿Olvidaste tu contraseña?": se pide el código por email
export function RecuperarScreen({ navigation, route }: Props) {
  const { colores } = useTema();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    // La tecla "Ir" del teclado no pasa por el botón deshabilitado
    if (enviando) {
      return;
    }
    const limpio = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
      setError('El email no es válido.');
      return;
    }
    setError('');
    setEnviando(true);
    try {
      await authApi.recuperar(limpio);
      navigation.navigate('Restablecer', { email: limpio });
    } catch (e) {
      setError(mensajeDeError(e));
    }
    setEnviando(false);
  };

  return (
    <Pantalla>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        Escribí el email de tu cuenta y te mandamos un código de 6 números para crear una contraseña nueva.
      </Text>
      <CampoTexto
        etiqueta="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={enviar}
      />
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo="Enviar código" onPress={enviar} cargando={enviando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  ayuda: { fontSize: 15, marginBottom: espaciado.l },
  error: { fontSize: 14, marginBottom: espaciado.m },
});
