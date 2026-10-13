import { createNavigationContainerRef } from '@react-navigation/native';
import type { RutasApp } from './AppNavigator';

// Para navegar desde fuera de las pantallas (por ejemplo, al tocar una notificación)
export const navegacion = createNavigationContainerRef<RutasApp>();
