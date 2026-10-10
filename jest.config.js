module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: [
    './node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js',
    './jest.setup.js',
  ],
  // La netbook es lenta: el primer render puede superar los 5 s por defecto
  testTimeout: 30000,
  // Estas librerías se publican como módulos ES y Jest tiene que transformarlas
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-[a-z-]+)?|@react-navigation|react-native-.*)/)',
  ],
};
