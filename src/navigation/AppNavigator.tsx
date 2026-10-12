import React from 'react';
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
import { NuevoTurnoScreen } from '../screens/agenda/NuevoTurnoScreen';
import { TurnoScreen } from '../screens/agenda/TurnoScreen';
import { TurnosFijosScreen } from '../screens/agenda/TurnosFijosScreen';
import { RecuperarScreen } from '../screens/auth/RecuperarScreen';
import { RegistroScreen } from '../screens/auth/RegistroScreen';
import { RestablecerScreen } from '../screens/auth/RestablecerScreen';
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
import { useTema } from '../theme/tema';

export type RutasAuth = {
  Login: undefined;
  Registro: undefined;
  // El email que ya estaba escrito en el login
  Recuperar: { email?: string } | undefined;
  Restablecer: { email: string };
};

// Con sesión: primero ConfigurarComplejo (si falta) y después las pestañas
export type RutasApp = {
  ConfigurarComplejo: undefined;
  // Un empleado se une al complejo de otro con un código de invitación
  Unirse: undefined;
  Empleados: undefined;
  Pestanas: undefined;
  Complejo: undefined;
  // Sin id: nueva cancha; con id: editar
  Cancha: { id?: number } | undefined;
  // Cancha y hora vienen del casillero tocado en la grilla
  NuevoTurno: { fecha: string; canchaId?: number; hora?: string };
  Turno: { id: number; recienCreado?: boolean };
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

const Pila = createNativeStackNavigator<RutasAuth>();
const PilaApp = createNativeStackNavigator<RutasApp>();
const Pestanas = createBottomTabNavigator<RutasPestanas>();

const iconos: Record<keyof RutasPestanas, NombreIcono> = {
  Inicio: 'inicio',
  Agenda: 'agenda',
  Canchas: 'canchas',
  Dashboard: 'grafico',
  Mas: 'mas',
};

// Fuera del componente para que React no lo recree en cada render
const iconoDe =
  (ruta: keyof RutasPestanas) =>
  ({ color, size }: { color: string; size: number }) =>
    <Icono nombre={iconos[ruta]} color={color} tamano={size} />;

// El empleado solo ve Inicio, Agenda y Más (sin canchas ni dashboard)
function Principal() {
  const { colores } = useTema();
  const esDueno = useEsDueno();
  return (
    <Pestanas.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.textoSecundario,
        tabBarIcon: iconoDe(route.name),
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
          <PilaApp.Screen name="Cancha" component={CanchaScreen} />
          <PilaApp.Screen name="NuevoTurno" component={NuevoTurnoScreen} options={{ title: 'Nuevo turno' }} />
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

function Autenticacion() {
  return (
    <Pila.Navigator>
      <Pila.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Pila.Screen name="Registro" component={RegistroScreen} options={{ title: 'Crear cuenta' }} />
      <Pila.Screen name="Recuperar" component={RecuperarScreen} options={{ title: 'Recuperar contraseña' }} />
      <Pila.Screen name="Restablecer" component={RestablecerScreen} options={{ title: 'Contraseña nueva' }} />
    </Pila.Navigator>
  );
}

// Con sesión se ve la app; sin sesión, el login. Al cambiar la sesión se cambia solo.
export function AppNavigator() {
  const { cargando, usuario, sinConexion, reintentar, cerrarSesion } = useSesion();
  const { colores } = useTema();

  if (cargando) {
    return (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  // Sesión guardada pero sin servidor: no se manda al login como si se hubiera cerrado
  if (sinConexion && !usuario) {
    return (
      <ErrorCarga
        mensaje="No se pudo conectar con el servidor. Revisá que XAMPP esté encendido y el celular conectado."
        onReintentar={reintentar}
        accion={{ titulo: 'Cerrar sesión', onPress: cerrarSesion }}
      />
    );
  }

  return usuario ? <Aplicacion tieneComplejo={usuario.tieneComplejo} /> : <Autenticacion />;
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
