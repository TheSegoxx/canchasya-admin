/**
 * CanchasYa: los jugadores reservan canchas y los dueños (con sus encargados) administran su complejo
 *
 * @format
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Appearance, StatusBar } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AvisosPush } from './src/components/AvisosPush';
import { PantallaDeCarga } from './src/components/PantallaDeCarga';
import { SesionProvider, useSesion } from './src/context/SesionContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { navegacion } from './src/navigation/referencia';
import { aplicarTema, leerPreferenciaTema } from './src/theme/preferencia';
import { FUENTE, useTema } from './src/theme/tema';

function App() {
  return (
    <SafeAreaProvider>
      <SesionProvider>
        <Contenido />
      </SesionProvider>
    </SafeAreaProvider>
  );
}

function Contenido() {
  const { oscuro, colores } = useTema();
  const { cargando } = useSesion();
  // El tema guardado se aplica antes de dibujar, así no se ve un instante con el otro
  const [temaListo, setTemaListo] = useState(false);
  // La pantalla de carga queda encima hasta que la sesión y el tema están listos
  const [cargaVisible, setCargaVisible] = useState(true);
  // La pantalla de carga sigue el modo del celular al abrir (como la del sistema), no el tema guardado
  const [cargaOscura] = useState(() => Appearance.getColorScheme() === 'dark');
  const ocultarCarga = useCallback(() => setCargaVisible(false), []);

  useEffect(() => {
    leerPreferenciaTema().then(preferencia => {
      aplicarTema(preferencia);
      setTemaListo(true);
    });
  }, []);

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
    // Títulos y pestañas con la fuente de la app
    fonts: {
      regular: { fontFamily: FUENTE, fontWeight: '400' },
      medium: { fontFamily: FUENTE, fontWeight: '500' },
      bold: { fontFamily: FUENTE, fontWeight: '600' },
      heavy: { fontFamily: FUENTE, fontWeight: '700' },
    },
  };

  return (
    <>
      {/* Los íconos de la barra de estado van claros sobre fondo oscuro y oscuros sobre fondo claro */}
      <StatusBar barStyle={(cargaVisible ? cargaOscura : oscuro) ? 'light-content' : 'dark-content'} />
      {temaListo && (
        <>
          <NavigationContainer ref={navegacion} theme={temaNavegacion}>
            <AppNavigator />
          </NavigationContainer>
          {/* Notificaciones push: registro del celular y aviso cuando llega una con la app abierta */}
          <AvisosPush />
        </>
      )}
      {cargaVisible && <PantallaDeCarga oscuro={cargaOscura} listo={temaListo && !cargando} alTerminar={ocultarCarga} />}
    </>
  );
}

export default App;
