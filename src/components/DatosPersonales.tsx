import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import type { Rol } from '../api/auth';
import { Deporte, NOMBRE_DEPORTE } from '../api/canchas';
import { espaciado, useTema } from '../theme/tema';
import { CampoTexto } from './CampoTexto';
import { Chip } from './Chip';

export type Perfil = { nombre: string; telefono: string; ciudad: string; deportes: Deporte[] };

export const PERFIL_VACIO: Perfil = { nombre: '', telefono: '', ciudad: '', deportes: [] };

// Mismas reglas que valida la API (AuthController::datosPersonales). Devuelve el problema o ''
export function validarPerfil(perfil: Perfil): string {
  if (!perfil.nombre.trim()) {
    return 'Ingresá tu nombre y apellido.';
  }
  const cifras = perfil.telefono.replace(/\D/g, '');
  if (cifras.length < 8) {
    return 'Ingresá tu celular con el código de área (por ejemplo, 351 555 1234).';
  }
  return '';
}

// Lo que se manda a la API: los deportes, solo si es jugador
export function perfilParaApi(perfil: Perfil, rol: Rol) {
  return {
    nombre: perfil.nombre.trim(),
    telefono: perfil.telefono.trim(),
    ciudad: perfil.ciudad.trim(),
    ...(rol === 'jugador' ? { deportes: perfil.deportes } : {}),
  };
}

type Props = { rol: Rol; valor: Perfil; onCambiar: (perfil: Perfil) => void };

/**
 * Datos personales de la cuenta. Todos: nombre y celular (el complejo lo usa para avisar por
 * WhatsApp). El jugador además: ciudad (para mostrarle complejos cerca) y los deportes que juega.
 */
export function DatosPersonales({ rol, valor, onCambiar }: Props) {
  const { colores } = useTema();
  const cambiar = (cambios: Partial<Perfil>) => onCambiar({ ...valor, ...cambios });
  const alternarDeporte = (d: Deporte) =>
    cambiar({ deportes: valor.deportes.includes(d) ? valor.deportes.filter(x => x !== d) : [...valor.deportes, d] });
  const esJugador = rol === 'jugador';

  return (
    <View>
      <CampoTexto
        etiqueta="Nombre y apellido"
        value={valor.nombre}
        onChangeText={nombre => cambiar({ nombre })}
        autoComplete="name"
        textContentType="name"
        maxLength={100}
      />
      <CampoTexto
        etiqueta="Celular con código de área"
        value={valor.telefono}
        onChangeText={telefono => cambiar({ telefono })}
        placeholder="351 555 1234"
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={30}
      />
      {esJugador && (
        <>
          <CampoTexto
            etiqueta="Ciudad o barrio (opcional)"
            value={valor.ciudad}
            onChangeText={ciudad => cambiar({ ciudad })}
            placeholder="Para mostrarte complejos cerca"
            maxLength={80}
          />
          <Text style={[estilos.seccion, { color: colores.texto }]}>¿Qué jugás?</Text>
          <View style={estilos.chips}>
            {(Object.keys(NOMBRE_DEPORTE) as Deporte[]).map(d => (
              <Chip key={d} texto={NOMBRE_DEPORTE[d]} seleccionado={valor.deportes.includes(d)} onPress={() => alternarDeporte(d)} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { fontSize: 15, fontWeight: '600', marginBottom: espaciado.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.m },
});
