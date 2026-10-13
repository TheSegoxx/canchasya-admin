/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registrarManejadorEnSegundoPlano } from './src/notificaciones';

// Antes de registrar la app, como pide Firebase
registrarManejadorEnSegundoPlano();
AppRegistry.registerComponent(appName, () => App);
