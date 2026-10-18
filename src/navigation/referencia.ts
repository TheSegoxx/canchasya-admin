import { createNavigationContainerRef } from '@react-navigation/native';
import type { RutasApp, RutasJugador } from './AppNavigator';

// Para navegar desde fuera de las pantallas (por ejemplo, al tocar una notificación).
// Según la cuenta, la pila es la del complejo o la del jugador.
export const navegacion = createNavigationContainerRef<RutasApp & RutasJugador>();
