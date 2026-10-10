/**
 * Canchero's — app para el dueño del complejo
 *
 * @format
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider } from './src/context/SesionContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useTema } from './src/theme/tema';

function App() {
  const { oscuro, colores } = useTema();

  // Los colores de las barras de navegación salen del mismo tema que el resto de la app
  const base = oscuro ? DarkTheme : DefaultTheme;
  const temaNavegacion: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colores.primario,
      background: colores.fondo,
      card: colores.superficie,
      text: colores.texto,
      border: colores.borde,
    },
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={oscuro ? 'light-content' : 'dark-content'} />
      <SesionProvider>
        <NavigationContainer theme={temaNavegacion}>
          <AppNavigator />
        </NavigationContainer>
      </SesionProvider>
    </SafeAreaProvider>
  );
}

export default App;
