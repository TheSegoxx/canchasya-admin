import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { authApi, RolElegible } from '../../api/auth';
import { Boton } from '../../components/Boton';
import { DatosPersonales, Perfil, PERFIL_VACIO, perfilParaApi, validarPerfil } from '../../components/DatosPersonales';
import { ElegirRol } from '../../components/ElegirRol';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError, useSesion } from '../../context/SesionContext';
import { espaciado, useTema } from '../../theme/tema';

/**
 * La primera vez que alguien entra con Google no eligió todavía cómo va a usar la app:
 * acá elige el rol (una sola vez) y completa sus datos personales.
 */
export function PerfilInicialScreen() {
  const { colores } = useTema();
  const { usuario, actualizarUsuario, cerrarSesion } = useSesion();
  const [rol, setRol] = useState<RolElegible | null>(null);
  const [perfil, setPerfil] = useState<Perfil>({ ...PERFIL_VACIO, nombre: usuario?.nombre ?? '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const continuar = async () => {
    if (guardando || !rol) {
      return;
    }
    const problema = validarPerfil(perfil);
    setError(problema);
    if (problema) {
      return;
    }
    setGuardando(true);
    try {
      // Con el rol elegido, la navegación pasa sola a la parte que le corresponde
      const respuesta = await authApi.guardarPerfil({ rol, ...perfilParaApi(perfil, rol) });
      actualizarUsuario(respuesta.usuario);
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  };

  return (
    <Pantalla conMargenSuperior>
      <Text style={[estilos.titulo, { color: colores.texto }]}>
        ¡Hola{usuario ? `, ${usuario.nombre.split(' ')[0]}` : ''}!
      </Text>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        ¿Cómo vas a usar CanchasYa? Elegilo una sola vez: después no se puede cambiar.
      </Text>
      <ElegirRol valor={rol} onCambiar={setRol} />

      {rol && (
        <>
          <Text style={[estilos.seccion, { color: colores.texto }]}>Tus datos</Text>
          <DatosPersonales rol={rol} valor={perfil} onCambiar={setPerfil} />
          {!!error && (
            <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
              {error}
            </Text>
          )}
          <Boton titulo="Continuar" onPress={continuar} cargando={guardando} />
        </>
      )}
      <View style={estilos.salir}>
        <Boton titulo="Salir de esta cuenta" variante="texto" onPress={cerrarSesion} deshabilitado={guardando} />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  titulo: { fontSize: 24, fontWeight: '700', marginBottom: espaciado.xs },
  ayuda: { fontSize: 15, lineHeight: 21, marginBottom: espaciado.l },
  seccion: { fontSize: 17, fontWeight: '700', marginTop: espaciado.s, marginBottom: espaciado.s },
  error: { fontSize: 14, marginBottom: espaciado.m },
  salir: { marginTop: espaciado.m, alignItems: 'center' },
});
