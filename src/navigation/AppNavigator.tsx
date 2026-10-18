import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ErrorCarga } from '../components/ErrorCarga';
import { Icono, NombreIcono } from '../components/Icono';
import type { Cliente } from '../api/agenda';
import type { Producto } from '../api/cobros';
import type { TipoMovimiento } from '../api/dashboard';
import { useEsDueno, useSesion } from '../context/SesionContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { AgendaScreen } from '../screens/agenda/AgendaScreen';
import { BloqueoScreen } from '../screens/agenda/BloqueoScreen';
import { TurnoScreen } from '../screens/agenda/TurnoScreen';
import { TurnosFijosScreen } from '../screens/agenda/TurnosFijosScreen';
import { RecuperarScreen } from '../screens/auth/RecuperarScreen';
import { RegistroScreen } from '../screens/auth/RegistroScreen';
import { RestablecerScreen } from '../screens/auth/RestablecerScreen';
import { ServidorScreen } from '../screens/auth/ServidorScreen';
import { ConfigurarServidor } from '../components/ConfigurarServidor';
import { CanchaScreen } from '../screens/canchas/CanchaScreen';
import { CanchasScreen } from '../screens/canchas/CanchasScreen';
import { ClienteScreen } from '../screens/clientes/ClienteScreen';
import { AgregarExtraScreen } from '../screens/cobros/AgregarExtraScreen';
import { CajaScreen } from '../screens/cobros/CajaScreen';
import { CobrarScreen } from '../screens/cobros/CobrarScreen';
import { LinkPagoScreen } from '../screens/cobros/LinkPagoScreen';
import { ProductoScreen } from '../screens/cobros/ProductoScreen';
import { ProductosScreen } from '../screens/cobros/ProductosScreen';
import { ClientesScreen } from '../screens/clientes/ClientesScreen';
import { ComplejoScreen } from '../screens/complejo/ComplejoScreen';
import { ReservasOnlineScreen } from '../screens/complejo/ReservasOnlineScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { EmpleadosScreen } from '../screens/empleados/EmpleadosScreen';
import { UnirseScreen } from '../screens/empleados/UnirseScreen';
import { MovimientoScreen } from '../screens/dashboard/MovimientoScreen';
import { MovimientosScreen } from '../screens/dashboard/MovimientosScreen';
import { HoyScreen } from '../screens/principal/HoyScreen';
import { NuevoTorneoScreen } from '../screens/torneos/NuevoTorneoScreen';
import { PartidoScreen } from '../screens/torneos/PartidoScreen';
import { TorneoScreen } from '../screens/torneos/TorneoScreen';
import { TorneosScreen } from '../screens/torneos/TorneosScreen';
import { MasScreen } from '../screens/principal/MasScreen';
import { MisDatosScreen } from '../screens/cuenta/MisDatosScreen';
import { PerfilInicialScreen } from '../screens/cuenta/PerfilInicialScreen';
import { BuscarScreen } from '../screens/jugador/BuscarScreen';
import { ComplejoJugadorScreen } from '../screens/jugador/ComplejoJugadorScreen';
import { MisReservasScreen } from '../screens/jugador/MisReservasScreen';
import { PerfilJugadorScreen } from '../screens/jugador/PerfilJugadorScreen';
import { ReservaScreen } from '../screens/jugador/ReservaScreen';
import { ReservarScreen } from '../screens/jugador/ReservarScreen';
import { useTema } from '../theme/tema';

export type RutasAuth = {
  Login: undefined;
  Registro: undefined;
  // El email que ya estaba escrito en el login
  Recuperar: { email?: string } | undefined;
  Restablecer: { email: string };
  // Dirección de la computadora con XAMPP (por si cambió la IP)
  Servidor: undefined;
};

// Dueño y encargado: primero ConfigurarComplejo (si falta) y después las pestañas
export type RutasApp = {
  MisDatos: undefined;
  ConfigurarComplejo: undefined;
  // Un empleado se une al complejo de otro con un código de invitación
  Unirse: undefined;
  Empleados: undefined;
  Pestanas: undefined;
  Complejo: undefined;
  // Seña y plazos de las reservas que hacen los jugadores desde la app
  ReservasOnline: undefined;
  // Sin id: nueva cancha; con id: editar
  Cancha: { id?: number } | undefined;
  // Cancha y hora vienen del casillero tocado en la grilla
  Turno: { id: number };
  Bloqueo: { fecha: string; canchaId?: number };
  TurnosFijos: undefined;
  Clientes: undefined;
  Cliente: { cliente: Cliente };
  Cobrar: { turnoId: number };
  AgregarExtra: { turnoId: number };
  LinkPago: { turnoId: number };
  Productos: undefined;
  // Sin producto: nuevo; con producto: editar
  Producto: { producto?: Producto };
  Caja: undefined;
  Movimientos: { desde: string; hasta: string; titulo: string };
  Movimiento: { tipo?: TipoMovimiento };
  Torneos: undefined;
  NuevoTorneo: undefined;
  Torneo: { id: number };
  Partido: { torneoId: number; partidoId: number };
};

export type RutasPestanas = {
  Inicio: undefined;
  Agenda: undefined;
  Canchas: undefined;
  Dashboard: undefined;
  Mas: undefined;
};

// Jugador (el cliente que reserva canchas)
export type RutasJugador = {
  PestanasJugador: undefined;
  MisDatos: undefined;
  // El nombre se muestra en el título mientras carga la ficha
  ComplejoJugador: { id: number; nombre: string };
  // Con canchaId, esa cancha ya viene elegida
  Reservar: { complejoId: number; canchaId?: number };
  // nueva: recién reservada (si eligió pagar, la app ya abrió Mercado Pago)
  Reserva: { id: number; nueva?: boolean };
};

export type RutasPestanasJugador = {
  Buscar: undefined;
  MisReservas: undefined;
  Perfil: undefined;
};

const Pila = createNativeStackNavigator<RutasAuth>();
const PilaApp = createNativeStackNavigator<RutasApp>();
const PilaJugador = createNativeStackNavigator<RutasJugador>();
const PilaPerfil = createNativeStackNavigator<{ PerfilInicial: undefined }>();
const Pestanas = createBottomTabNavigator<RutasPestanas>();
const PestanasJugador = createBottomTabNavigator<RutasPestanasJugador>();

const iconos: Record<keyof RutasPestanas | keyof RutasPestanasJugador, NombreIcono> = {
  Inicio: 'inicio',
  Agenda: 'agenda',
  Canchas: 'canchas',
  Dashboard: 'grafico',
  Mas: 'mas',
  Buscar: 'buscar',
  MisReservas: 'agenda',
  Perfil: 'persona',
};

// Fuera del componente para que React no lo recree en cada render.
// La pestaña activa lleva el detalle en verde; las otras van en gris.
const iconoDe =
  (ruta: keyof typeof iconos, acento: string) =>
  ({ color, size, focused }: { color: string; size: number; focused: boolean }) =>
    <Icono nombre={iconos[ruta]} color={color} acento={focused ? acento : color} tamano={size} />;

// El empleado solo ve Inicio, Agenda y Más (sin canchas ni dashboard)
function Principal() {
  const { colores } = useTema();
  const esDueno = useEsDueno();
  return (
    <Pestanas.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colores.texto,
        tabBarInactiveTintColor: colores.textoSecundario,
        tabBarIcon: iconoDe(route.name, colores.acento),
        tabBarLabelStyle: estilos.etiquetaPestana,
        tabBarStyle: { borderTopColor: colores.borde, elevation: 0 },
      })}>
      <Pestanas.Screen name="Inicio" component={HoyScreen} options={{ title: 'Hoy', tabBarLabel: 'Inicio' }} />
      <Pestanas.Screen name="Agenda" component={AgendaScreen} />
      {esDueno && (
        <>
          <Pestanas.Screen name="Canchas" component={CanchasScreen} />
          <Pestanas.Screen name="Dashboard" component={DashboardScreen} />
        </>
      )}
      <Pestanas.Screen name="Mas" component={MasScreen} options={{ title: 'Más' }} />
    </Pestanas.Navigator>
  );
}

function Aplicacion({ tieneComplejo }: { tieneComplejo: boolean }) {
  return (
    <PilaApp.Navigator>
      {tieneComplejo ? (
        <>
          <PilaApp.Screen name="Pestanas" component={Principal} options={{ headerShown: false }} />
          <PilaApp.Screen name="Complejo" component={ComplejoScreen} options={{ title: 'Datos del complejo' }} />
          <PilaApp.Screen name="ReservasOnline" component={ReservasOnlineScreen} options={{ title: 'Reservas desde la app' }} />
          <PilaApp.Screen name="Cancha" component={CanchaScreen} />
          <PilaApp.Screen name="Turno" component={TurnoScreen} />
          <PilaApp.Screen name="Bloqueo" component={BloqueoScreen} options={{ title: 'Bloquear horario' }} />
          <PilaApp.Screen name="TurnosFijos" component={TurnosFijosScreen} options={{ title: 'Turnos fijos' }} />
          <PilaApp.Screen name="Clientes" component={ClientesScreen} />
          <PilaApp.Screen name="Cliente" component={ClienteScreen} options={{ title: 'Cliente' }} />
          <PilaApp.Screen name="Cobrar" component={CobrarScreen} options={{ title: 'Cobrar' }} />
          <PilaApp.Screen name="LinkPago" component={LinkPagoScreen} options={{ title: 'Link de Mercado Pago' }} />
          <PilaApp.Screen name="AgregarExtra" component={AgregarExtraScreen} options={{ title: 'Agregar extra' }} />
          <PilaApp.Screen name="Productos" component={ProductosScreen} options={{ title: 'Productos y extras' }} />
          <PilaApp.Screen name="Producto" component={ProductoScreen} />
          <PilaApp.Screen name="Caja" component={CajaScreen} options={{ title: 'Caja del día' }} />
          <PilaApp.Screen name="Movimientos" component={MovimientosScreen} />
          <PilaApp.Screen name="Movimiento" component={MovimientoScreen} options={{ title: 'Cargar gasto o ingreso' }} />
          <PilaApp.Screen name="Empleados" component={EmpleadosScreen} />
          <PilaApp.Screen name="Torneos" component={TorneosScreen} options={{ title: 'Torneos y ligas' }} />
          <PilaApp.Screen name="NuevoTorneo" component={NuevoTorneoScreen} options={{ title: 'Nuevo torneo' }} />
          <PilaApp.Screen name="Torneo" component={TorneoScreen} options={{ title: 'Torneo' }} />
          <PilaApp.Screen name="Partido" component={PartidoScreen} options={{ title: 'Partido' }} />
          <PilaApp.Screen name="MisDatos" component={MisDatosScreen} options={{ title: 'Mis datos' }} />
        </>
      ) : (
        <>
          <PilaApp.Screen
            name="ConfigurarComplejo"
            component={ComplejoScreen}
            options={{ title: 'Configurá tu complejo' }}
          />
          <PilaApp.Screen name="Unirse" component={UnirseScreen} options={{ title: 'Unirme a un complejo' }} />
        </>
      )}
    </PilaApp.Navigator>
  );
}

// Las pestañas del jugador: buscar dónde jugar, sus reservas y su perfil
function PrincipalJugador() {
  const { colores } = useTema();
  return (
    <PestanasJugador.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colores.texto,
        tabBarInactiveTintColor: colores.textoSecundario,
        tabBarIcon: iconoDe(route.name, colores.acento),
        tabBarLabelStyle: estilos.etiquetaPestana,
        tabBarStyle: { borderTopColor: colores.borde, elevation: 0 },
      })}>
      <PestanasJugador.Screen name="Buscar" component={BuscarScreen} options={{ headerShown: false }} />
      <PestanasJugador.Screen name="MisReservas" component={MisReservasScreen} options={{ title: 'Mis reservas' }} />
      <PestanasJugador.Screen name="Perfil" component={PerfilJugadorScreen} />
    </PestanasJugador.Navigator>
  );
}

function AplicacionJugador() {
  return (
    <PilaJugador.Navigator>
      <PilaJugador.Screen name="PestanasJugador" component={PrincipalJugador} options={{ headerShown: false }} />
      <PilaJugador.Screen name="MisDatos" component={MisDatosScreen} options={{ title: 'Mis datos' }} />
      <PilaJugador.Screen name="ComplejoJugador" component={ComplejoJugadorScreen} />
      <PilaJugador.Screen name="Reservar" component={ReservarScreen} options={{ title: 'Reservar' }} />
      <PilaJugador.Screen name="Reserva" component={ReservaScreen} options={{ title: 'Tu reserva' }} />
    </PilaJugador.Navigator>
  );
}

// Entró con Google por primera vez: elige si es jugador o dueño antes de seguir
function PrimerIngreso() {
  return (
    <PilaPerfil.Navigator>
      <PilaPerfil.Screen name="PerfilInicial" component={PerfilInicialScreen} options={{ headerShown: false }} />
    </PilaPerfil.Navigator>
  );
}

function Autenticacion() {
  return (
    <Pila.Navigator>
      <Pila.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Pila.Screen name="Registro" component={RegistroScreen} options={{ title: 'Crear cuenta' }} />
      <Pila.Screen name="Recuperar" component={RecuperarScreen} options={{ title: 'Recuperar contraseña' }} />
      <Pila.Screen name="Restablecer" component={RestablecerScreen} options={{ title: 'Contraseña nueva' }} />
      <Pila.Screen name="Servidor" component={ServidorScreen} options={{ title: 'Servidor' }} />
    </Pila.Navigator>
  );
}

// Con sesión se ve la app; sin sesión, el login. Al cambiar la sesión se cambia solo.
export function AppNavigator() {
  const { cargando, usuario, sinConexion, reintentar, cerrarSesion } = useSesion();
  const { colores } = useTema();
  const [cambiandoServidor, setCambiandoServidor] = useState(false);

  if (cargando) {
    return (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  // Sesión guardada pero sin servidor: no se manda al login como si se hubiera cerrado
  if (sinConexion && !usuario) {
    if (cambiandoServidor) {
      return (
        <ConfigurarServidor
          alGuardar={() => {
            setCambiandoServidor(false);
            reintentar();
          }}
          alCancelar={() => setCambiandoServidor(false)}
        />
      );
    }
    return (
      <ErrorCarga
        mensaje="No se pudo conectar con el servidor. Revisá que XAMPP esté encendido y que el celular esté en el mismo WiFi que la computadora."
        onReintentar={reintentar}
        accion={{ titulo: 'Cambiar la dirección del servidor', onPress: () => setCambiandoServidor(true) }}
        otraAccion={{ titulo: 'Cerrar sesión', onPress: cerrarSesion }}
      />
    );
  }

  // Cada tipo de cuenta tiene su propia parte de la app
  if (!usuario) {
    return <Autenticacion />;
  }
  if (!usuario.rolElegido) {
    return <PrimerIngreso />;
  }
  return usuario.rol === 'jugador' ? <AplicacionJugador /> : <Aplicacion tieneComplejo={usuario.tieneComplejo} />;
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  etiquetaPestana: { fontSize: 11, fontWeight: '500' },
});
