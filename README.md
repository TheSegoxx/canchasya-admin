# CanchasYa Admin

App Android para que el dueño de un complejo de pádel y fútbol 5 administre todo desde el celular:
canchas, precios por horario, turnos, cobros e ingresos.

- **App:** React Native 0.87 (CLI) + TypeScript, solo Android 7.0 o superior.
- **API:** PHP 8.2 + MySQL/MariaDB sobre XAMPP (carpeta `backend/`).
- **Login:** email y contraseña o cuenta de Google.

## Puesta en marcha

1. **Base de datos:** con XAMPP encendido (Apache y MySQL), importar `backend/database/schema.sql`.
   Crea la base `canchasya`.
2. **API:**
   - Copiar `backend/.env.example` como `backend/.env` y completar `JWT_SECRET` y `GOOGLE_WEB_CLIENT_ID`.
   - Ejecutar `composer install` dentro de `backend/`.
   - Crear el acceso desde XAMPP:
     `mklink /J C:\xampp\htdocs\canchasya <ruta del proyecto>\backend`
   - Probar con `http://localhost/canchasya/api/salud`.
3. **App:** `npm install`, conectar el celular por USB con la depuración activada y ejecutar:

   ```sh
   adb reverse tcp:8081 tcp:8081   # Metro
   adb reverse tcp:8080 tcp:80     # API de XAMPP
   npm start
   npm run android
   ```

## Pruebas

```sh
npm test          # Jest
npx tsc --noEmit  # tipos
npm run lint      # ESLint
```
