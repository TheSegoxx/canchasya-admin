# CanchasYa Admin

App Android para que el dueño de un complejo de pádel y fútbol 5 administre todo desde el celular.

- **Agenda:** grilla de canchas × horarios y vista lista, turnos fijos semanales, bloqueos (lluvia,
  mantenimiento) y confirmaciones o avisos por WhatsApp.
- **Cobros:** seña y saldo en efectivo, transferencia o **link de Mercado Pago**, extras (paletas,
  pelotas, bebidas) y caja del día.
- **Dashboard:** ingresos, egresos y balance por semana, mes o año, con gráficos.
- **Torneos y ligas:** fixture por sorteo, resultados, tabla de posiciones y partidos reservados en la agenda.
- **Encargados:** el dueño invita empleados con un código; operan la agenda y la caja, sin ver precios
  ni el dashboard.
- Fotos del complejo y de las canchas, tema claro u oscuro, login con email o Google.

**Tecnologías:** React Native 0.87 (CLI) + TypeScript para Android 7.0 o superior; API en PHP 8.2 +
MySQL/MariaDB sobre XAMPP (carpeta `backend/`).

## Puesta en marcha

1. **Base de datos:** con XAMPP encendido (Apache y MySQL):
   - Instalación nueva: importar `backend/database/schema.sql` (crea la base `canchasya` completa).
   - Base de una versión anterior: aplicar en orden los archivos de `backend/database/migraciones/`
     que falten (`mysql -u root < backend/database/migraciones/00X_....sql`). No borran datos.
2. **API:**
   - Copiar `backend/.env.example` como `backend/.env` y completar `JWT_SECRET` y `GOOGLE_WEB_CLIENT_ID`.
   - Opcional: `MP_ACCESS_TOKEN` con el Access Token de Mercado Pago (para los links de pago).
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
