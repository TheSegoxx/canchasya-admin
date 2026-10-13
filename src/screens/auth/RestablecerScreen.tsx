import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi } from '../../api/auth';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import type { RutasAuth } from '../../navigation/AppNavigator';
import { espaciado, useTema } from '../../theme/tema';

type Props = NativeStackScreenProps<RutasAuth, 'Restablecer'>;

// La API no manda más de un código por minuto
const ESPERA_PARA_REENVIAR_SEG = 60;

// Mismas reglas que valida la API en AuthController::restablecer
function validar(codigo: string, password: string, repetir: string): string {
  if (!/^\d{6}$/.test(codigo)) {
    return 'El código tiene 6 números.';
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

// Paso 2: el código que llegó por email y la contraseña nueva. Si sale bien, entra directo a la app.
export function RestablecerScreen({ route }: Props) {
  const { email } = route.params;
  const { colores } = useTema();
  const { restablecerPassword } = useSesion();
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [espera, setEspera] = useState(ESPERA_PARA_REENVIAR_SEG);

  useEffect(() => {
    if (espera <= 0) {
      return;
    }
    const temporizador = setTimeout(() => setEspera(s => s - 1), 1000);
    return () => clearTimeout(temporizador);
  }, [espera]);

  const cambiar = async () => {
    if (enviando) {
      return;
    }
    const problema = validar(codigo, password, repetir);
    setError(problema);
    setAviso('');
    if (problema) {
      return;
    }
    setEnviando(true);
    try {
      // Si sale bien, la sesión cambia y la navegación pasa sola a la app
      await restablecerPassword(email, codigo, password);
    } catch (e) {
      setError(mensajeDeError(e));
      setEnviando(false);
    }
  };

  const reenviar = async () => {
    setError('');
    setAviso('');
    setReenviando(true);
    try {
      await authApi.recuperar(email);
      setCodigo('');
      setAviso('Te mandamos un código nuevo. El anterior ya no sirve.');
      setEspera(ESPERA_PARA_REENVIAR_SEG);
    } catch (e) {
      setError(mensajeDeError(e));
    }
    setReenviando(false);
  };

  return (
    <Pantalla>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        Si <Text style={[estilos.email, { color: colores.texto }]}>{email}</Text> tiene una cuenta, te llegó un
        código que vence en 15 minutos. Si no lo ves, revisá la carpeta de spam.
      </Text>
      <CampoTexto
        etiqueta="Código"
        value={codigo}
        onChangeText={texto => setCodigo(texto.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        style={estilos.codigo}
      />
      <CampoTexto
        etiqueta="Contraseña nueva (mínimo 8 caracteres)"
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
        onSubmitEditing={cambiar}
      />
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.mensaje, { color: colores.error }]}>
          {error}
        </Text>
      )}
      {!!aviso && (
        <Text accessibilityLiveRegion="polite" style={[estilos.mensaje, { color: colores.primario }]}>
          {aviso}
        </Text>
      )}
      <Boton titulo="Cambiar contraseña" onPress={cambiar} cargando={enviando} deshabilitado={reenviando} />
      <View style={estilos.espacio} />
      <Boton
        titulo={espera > 0 ? `Reenviar código (${espera} s)` : 'Reenviar código'}
        variante="texto"
        onPress={reenviar}
        cargando={reenviando}
        deshabilitado={espera > 0 || enviando}
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  ayuda: { fontSize: 15, marginBottom: espaciado.l },
  email: { fontWeight: '700' },
  codigo: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontVariant: ['tabular-nums'] },
  mensaje: { fontSize: 14, marginBottom: espaciado.m },
  espacio: { height: espaciado.s },
});
