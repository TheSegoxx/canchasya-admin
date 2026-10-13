import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import type { RutasAuth } from '../../navigation/AppNavigator';
import { espaciado, useTema } from '../../theme/tema';

type Props = NativeStackScreenProps<RutasAuth, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { colores, oscuro } = useTema();
  const { entrarConEmail, entrarConGoogle } = useSesion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState<'email' | 'google' | null>(null);

  const entrar = async () => {
    // La tecla "Ir" del teclado no pasa por el botón deshabilitado
    if (enviando) {
      return;
    }
    if (!email.trim() || !password) {
      setError('Completá el email y la contraseña.');
      return;
    }
    setError('');
    setEnviando('email');
    try {
      await entrarConEmail(email.trim(), password);
    } catch (e) {
      setError(mensajeDeError(e));
      setEnviando(null);
    }
  };

  const entrarGoogle = async () => {
    setError('');
    setEnviando('google');
    try {
      await entrarConGoogle();
    } catch (e) {
      setError(mensajeDeError(e));
    }
    setEnviando(null);
  };

  return (
    <Pantalla conMargenSuperior centrado>
      <Image
        source={require('../../../assets/app/logo.png')}
        style={estilos.logo}
        fadeDuration={0}
        accessibilityRole="image"
        accessibilityLabel="CanchasYa Admin"
      />
      <Text style={[estilos.subtitulo, { color: colores.textoSecundario }]}>
        Administrá tu complejo: canchas, turnos y cobros.
      </Text>

      <View style={estilos.google}>
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={oscuro ? 'dark' : 'light'}
          onPress={entrarGoogle}
          disabled={enviando !== null}
          style={estilos.botonGoogle}
        />
      </View>

      <View style={estilos.separador}>
        <View style={[estilos.linea, { backgroundColor: colores.borde }]} />
        <Text style={[estilos.o, { color: colores.textoSecundario }]}>o con tu email</Text>
        <View style={[estilos.linea, { backgroundColor: colores.borde }]} />
      </View>

      <CampoTexto
        etiqueta="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="dueño@complejo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <CampoTexto
        etiqueta="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={entrar}
      />
      <View style={estilos.olvide}>
        <Boton
          titulo="¿Olvidaste tu contraseña?"
          variante="texto"
          onPress={() => navigation.navigate('Recuperar', { email: email.trim() })}
          deshabilitado={enviando !== null}
        />
      </View>

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}

      <Boton
        titulo="Ingresar"
        onPress={entrar}
        cargando={enviando === 'email'}
        deshabilitado={enviando !== null}
      />
      <View style={estilos.espacio} />
      <Boton
        titulo="Crear una cuenta"
        variante="texto"
        onPress={() => navigation.navigate('Registro')}
        deshabilitado={enviando !== null}
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  logo: { width: 132, height: 132, alignSelf: 'center' },
  subtitulo: { fontSize: 15, textAlign: 'center', marginTop: espaciado.m, marginBottom: espaciado.xl },
  google: { alignItems: 'center' },
  botonGoogle: { width: '100%', height: 52 },
  separador: { flexDirection: 'row', alignItems: 'center', marginVertical: espaciado.l },
  linea: { flex: 1, height: StyleSheet.hairlineWidth },
  o: { marginHorizontal: espaciado.s, fontSize: 14 },
  olvide: { alignSelf: 'flex-end', marginTop: -espaciado.s, marginBottom: espaciado.s },
  error: { fontSize: 14, marginBottom: espaciado.m },
  espacio: { height: espaciado.s },
});
