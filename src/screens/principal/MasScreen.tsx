import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Boton } from '../../components/Boton';
import { Icono, NombreIcono } from '../../components/Icono';
import { Pantalla } from '../../components/Pantalla';
import { SelectorTema } from '../../components/SelectorTema';
import { TarjetaCuenta } from '../../components/TarjetaCuenta';
import { useEsDueno, useSesion } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';

type Opcion = {
  titulo: string;
  icono: NombreIcono;
  ruta: 'Complejo' | 'ReservasOnline' | 'Empleados' | 'Torneos' | 'TurnosFijos' | 'Clientes' | 'Productos' | 'MisDatos';
  soloDueno?: boolean;
};

// El encargado no ve los datos del complejo, las reglas de reserva, los empleados ni los productos
const OPCIONES: Opcion[] = [
  { titulo: 'Datos del complejo', icono: 'complejo', ruta: 'Complejo', soloDueno: true },
  { titulo: 'Reservas desde la app', icono: 'reloj', ruta: 'ReservasOnline', soloDueno: true },
  { titulo: 'Empleados', icono: 'empleados', ruta: 'Empleados', soloDueno: true },
  { titulo: 'Torneos y ligas', icono: 'torneos', ruta: 'Torneos' },
  { titulo: 'Turnos fijos', icono: 'turnosFijos', ruta: 'TurnosFijos' },
  { titulo: 'Clientes', icono: 'clientes', ruta: 'Clientes' },
  { titulo: 'Productos y extras', icono: 'productos', ruta: 'Productos', soloDueno: true },
];

// Pestaña "Más" del dueño y del encargado: el resto de la gestión, sus datos, el tema y cerrar sesión
export function MasScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const { usuario } = useSesion();
  const esDueno = useEsDueno();

  if (!usuario) {
    return null;
  }

  const opciones = OPCIONES.filter(o => esDueno || !o.soloDueno);

  return (
    <Pantalla>
      <TarjetaCuenta
        usuario={usuario}
        detalle={usuario.complejo ? `${esDueno ? 'Dueño' : 'Encargado'} de ${usuario.complejo}` : null}
      />

      <Text style={[estilos.seccion, { color: colores.textoSecundario }]}>Gestión</Text>
      <ListaOpciones opciones={opciones} onElegir={ruta => navigation.navigate(ruta)} />

      <Text style={[estilos.seccion, { color: colores.textoSecundario }]}>Cuenta</Text>
      <ListaOpciones
        opciones={[{ titulo: 'Mis datos', icono: 'persona', ruta: 'MisDatos' }]}
        onElegir={ruta => navigation.navigate(ruta)}
      />

      <Text style={[estilos.seccion, { color: colores.textoSecundario }]}>Tema</Text>
      <SelectorTema />

      <BotonCerrarSesion />
    </Pantalla>
  );
}

// Grupo de filas con ícono y flecha (también lo usa el perfil del jugador)
export function ListaOpciones<R extends string>({
  opciones,
  onElegir,
}: {
  opciones: { titulo: string; icono: NombreIcono; ruta: R }[];
  onElegir: (ruta: R) => void;
}) {
  const { colores } = useTema();
  return (
    <View style={[estilos.grupo, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      {opciones.map((opcion, i) => (
        <Pressable
          key={opcion.ruta}
          accessibilityRole="button"
          onPress={() => onElegir(opcion.ruta)}
          style={({ pressed }) => [
            estilos.fila,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colores.borde },
            pressed && { backgroundColor: colores.borde + '66' },
          ]}>
          <Icono nombre={opcion.icono} color={colores.texto} acento={colores.acento} tamano={22} />
          <Text style={[estilos.textoFila, { color: colores.texto }]}>{opcion.titulo}</Text>
          <Icono nombre="siguiente" color={colores.inactivo} tamano={18} />
        </Pressable>
      ))}
    </View>
  );
}

export function BotonCerrarSesion() {
  const { colores } = useTema();
  const { cerrarSesion } = useSesion();
  const [saliendo, setSaliendo] = useState(false);

  const confirmarSalida = () =>
    Alert.alert('Cerrar sesión', '¿Querés salir de tu cuenta en este celular?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          setSaliendo(true);
          await cerrarSesion();
        },
      },
    ]);

  return (
    <View style={estilos.salir}>
      <Boton titulo="Cerrar sesión" variante="texto" color={colores.error} onPress={confirmarSalida} cargando={saliendo} />
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: espaciado.s,
    marginLeft: espaciado.xs,
  },
  grupo: { borderRadius: radio, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: espaciado.l },
  fila: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: espaciado.m },
  textoFila: { flex: 1, fontSize: 15, fontWeight: '500', marginLeft: 14 },
  salir: { alignItems: 'center' },
});
