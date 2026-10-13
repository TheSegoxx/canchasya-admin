const fs = require('fs');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  // El APK de release se compila desde una unidad corta (subst W:, por el límite de 260
  // caracteres de Windows). Node resuelve algunos archivos a la carpeta real (C:\...),
  // así que Metro también tiene que vigilarla. Si ya es la misma carpeta, no cambia nada.
  watchFolders: [fs.realpathSync.native(__dirname)].filter(carpeta => carpeta !== __dirname),
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
