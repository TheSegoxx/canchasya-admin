/**
 * Configuración general de la app.
 */

// La dirección del servidor (XAMPP) está en src/servidor.ts: se puede cambiar desde el login.

// ID de cliente "Aplicación web" de Google Cloud. No es un secreto:
// sirve para que Google emita un idToken que nuestra API pueda verificar.
export const GOOGLE_WEB_CLIENT_ID =
  '564959080045-ojjsbbgikqm65fqv2ms5eiuvr8qd9t1j.apps.googleusercontent.com';

// Tiempo máximo de espera de una petición a la API
export const TIEMPO_ESPERA_MS = 15000;
