import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '../../components/Texto';
import type { RolElegible } from '../../api/auth';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { DatosPersonales, Perfil, PERFIL_VACIO, perfilParaApi, validarPerfil } from '../../components/DatosPersonales';
import { ElegirRol } from '../../components/ElegirRol';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import { espaciado, useTema } from '../../theme/tema';

// Mismas reglas que valida la API en AuthController::registrar
function validarCuenta(email: string, password: string, repetir: string): string {
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

/**
 * Crear cuenta: primero se elige cómo se va a usar la app (reservar canchas o administrar un
 * complejo) y ahí se despliegan los datos personales de ese tipo de cuenta.
 */
export function RegistroScreen() {
  const { colores } = useTema();
  const { registrarse } = useSesion();
  const [rol, setRol] = useState<RolElegible | null>(null);
  const [perfil, setPerfil] = useState<Perfil>(PERFIL_VACIO);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const crear = async () => {
    // La tecla "Ir" del teclado no pasa por el botón deshabilitado
    if (enviando || !rol) {
      return;
    }
    const problema = validarPerfil(perfil) || validarCuenta(email, password, repetir);
    setError(problema);
    if (problema) {
      return;
    }
    setEnviando(true);
    try {
      // Si sale bien, la sesión cambia y la navegación pasa sola a la parte de su rol
      await registrarse({ rol, ...perfilParaApi(perfil, rol), email: email.trim(), password });
    } catch (e) {
      setError(mensajeDeError(e));
      setEnviando(false);
    }
  };

  return (
    <Pantalla>
      <Text style={[estilos.titulo, { color: colores.texto }]}>¿Cómo vas a usar CanchasYa?</Text>
      <ElegirRol
        valor={rol}
        onCambiar={nuevo => {
          setRol(nuevo);
          setError('');
        }}
      />

      {rol && (
        <>
          <Text style={[estilos.seccion, { color: colores.texto }]}>Tus datos</Text>
          <DatosPersonales rol={rol} valor={perfil} onCambiar={setPerfil} />

          <Text style={[estilos.seccion, { color: colores.texto }]}>Tu cuenta</Text>
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
          <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
            También podés entrar directamente con Google desde la pantalla anterior.
          </Text>
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  titulo: { fontSize: 20, fontWeight: '700', marginBottom: espaciado.m },
  seccion: { fontSize: 17, fontWeight: '700', marginTop: espaciado.s, marginBottom: espaciado.s },
  ayuda: { fontSize: 14, textAlign: 'center', marginTop: espaciado.m },
  error: { fontSize: 14, marginBottom: espaciado.m },
});
