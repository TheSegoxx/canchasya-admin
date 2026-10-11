import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import { espaciado, useTema } from '../../theme/tema';

// Mismas reglas que valida la API en AuthController::registrar
function validar(nombre: string, email: string, password: string, repetir: string): string {
  if (!nombre.trim()) {
    return 'Ingresá tu nombre.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'El email no es válido.';
  }
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (password.length > 72) {
    return 'La contraseña no puede superar los 72 caracteres.';
  }
  if (password !== repetir) {
    return 'Las contraseñas no coinciden.';
  }
  return '';
}

export function RegistroScreen() {
  const { colores } = useTema();
  const { registrarse } = useSesion();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const crear = async () => {
    // La tecla "Ir" del teclado no pasa por el botón deshabilitado
    if (enviando) {
      return;
    }
    const problema = validar(nombre, email, password, repetir);
    setError(problema);
    if (problema) {
      return;
    }
    setEnviando(true);
    try {
      // Si sale bien, la sesión cambia y la navegación pasa sola a la app
      await registrarse(nombre.trim(), email.trim(), password);
    } catch (e) {
      setError(mensajeDeError(e));
      setEnviando(false);
    }
  };

  return (
    <Pantalla>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        Creá la cuenta del dueño del complejo. También podés entrar directamente con Google.
      </Text>
      <CampoTexto
        etiqueta="Nombre y apellido"
        value={nombre}
        onChangeText={setNombre}
        autoComplete="name"
        textContentType="name"
        maxLength={100}
      />
      <CampoTexto
        etiqueta="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <CampoTexto
        etiqueta="Contraseña (mínimo 8 caracteres)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <CampoTexto
        etiqueta="Repetir contraseña"
        value={repetir}
        onChangeText={setRepetir}
        secureTextEntry
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={crear}
      />
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo="Crear cuenta" onPress={crear} cargando={enviando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  ayuda: { fontSize: 15, marginBottom: espaciado.l },
  error: { fontSize: 14, marginBottom: espaciado.m },
});
