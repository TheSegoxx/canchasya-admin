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
- **Notificaciones push:** turno nuevo o cancelado por otro del equipo, pago recibido por Mercado Pago,
  recordatorio 30 minutos antes de un turno que todavía debe plata y resumen de la caja al cierre.
- Fotos del complejo y de las canchas, tema claro u oscuro, login con email o Google y recuperación
  de la contraseña con un código por email.

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
   - `MAIL_USUARIO` y `MAIL_CLAVE` con la cuenta que manda el código de "¿Olvidaste tu contraseña?"
     (en desarrollo, si quedan vacíos, los correos se guardan en `backend/storage/correos.log`).
   - Notificaciones push: en Firebase (Configuración del proyecto → Cuentas de servicio) generar una clave
     privada y guardarla como `backend/storage/firebase-cuenta-servicio.json`. Nunca va en la app ni en GitHub.
   - Ejecutar `composer install` dentro de `backend/`.
   - Crear el acceso desde XAMPP:
     `mklink /J C:\xampp\htdocs\canchasya <ruta del proyecto>\backend`
   - Probar con `http://localhost/canchasya/api/salud`.
   - Avisos automáticos (recordatorios, pagos de Mercado Pago y resumen de caja): ejecutar una vez
     `backend\bin\instalar-avisos.bat`, que crea una tarea del Programador de tareas de Windows que corre
     `bin/avisos.php` cada minuto. Lo que envía queda en `backend/storage/avisos.log`.
3. **App:** la app de Android registrada en el mismo proyecto de Firebase (paquete `com.canchasamigos`)
   da el archivo `google-services.json`, que va en `android/app/`. Después: `npm install`, conectar el celular por USB con la depuración activada y ejecutar:

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
