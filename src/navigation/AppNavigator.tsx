import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Icono, NombreIcono } from '../components/Icono';
import { useSesion } from '../context/SesionContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegistroScreen } from '../screens/auth/RegistroScreen';
import { ComplejoScreen } from '../screens/complejo/ComplejoScreen';
import { AgendaScreen, CanchasScreen, InicioScreen } from '../screens/principal/EnConstruccion';
import { MasScreen } from '../screens/principal/MasScreen';
import { useTema } from '../theme/tema';

export type RutasAuth = {
  Login: undefined;
  Registro: undefined;
};

// Con sesión: primero ConfigurarComplejo (si falta) y después las pestañas
export type RutasApp = {
  ConfigurarComplejo: undefined;
  Pestanas: undefined;
  Complejo: undefined;
};

export type RutasPestanas = {
  Inicio: undefined;
  Agenda: undefined;
  Canchas: undefined;
  Mas: undefined;
};

const Pila = createNativeStackNavigator<RutasAuth>();
const PilaApp = createNativeStackNavigator<RutasApp>();
const Pestanas = createBottomTabNavigator<RutasPestanas>();

const iconos: Record<keyof RutasPestanas, NombreIcono> = {
  Inicio: 'inicio',
  Agenda: 'agenda',
  Canchas: 'canchas',
  Mas: 'mas',
};

// Fuera del componente para que React no lo recree en cada render
const iconoDe =
  (ruta: keyof RutasPestanas) =>
  ({ color, size }: { color: string; size: number }) =>
    <Icono nombre={iconos[ruta]} color={color} tamano={size} />;

function Principal() {
  const { colores } = useTema();
  return (
    <Pestanas.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.textoSecundario,
        tabBarIcon: iconoDe(route.name),
      })}>
      <Pestanas.Screen name="Inicio" component={InicioScreen} options={{ title: 'Ingresos', tabBarLabel: 'Inicio' }} />
      <Pestanas.Screen name="Agenda" component={AgendaScreen} />
      <Pestanas.Screen name="Canchas" component={CanchasScreen} />
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
        </>
      ) : (
        <PilaApp.Screen
          name="ConfigurarComplejo"
          component={ComplejoScreen}
          options={{ title: 'Configurá tu complejo' }}
        />
      )}
    </PilaApp.Navigator>
  );
}

function Autenticacion() {
  return (
    <Pila.Navigator>
      <Pila.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Pila.Screen name="Registro" component={RegistroScreen} options={{ title: 'Crear cuenta' }} />
    </Pila.Navigator>
  );
}

// Con sesión se ve la app; sin sesión, el login. Al cambiar la sesión se cambia solo.
export function AppNavigator() {
  const { cargando, usuario } = useSesion();
  const { colores } = useTema();

  if (cargando) {
    return (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  return usuario ? <Aplicacion tieneComplejo={usuario.tieneComplejo} /> : <Autenticacion />;
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
