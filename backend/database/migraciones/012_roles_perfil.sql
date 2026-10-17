-- =============================================================
-- Migración 012: una sola app para todos. Además del dueño y el encargado,
-- el jugador (el cliente que reserva canchas), y los datos personales de cada cuenta.
-- No borra datos. Uso: mysql -u root < database/migraciones/012_roles_perfil.sql
-- =============================================================

USE canchasya;

ALTER TABLE usuarios
    MODIFY COLUMN rol ENUM('dueno', 'empleado', 'jugador') NOT NULL DEFAULT 'dueno',
    ADD COLUMN rol_elegido BOOLEAN NOT NULL DEFAULT 1
        COMMENT '0 = entró con Google y todavía no eligió si es jugador o dueño' AFTER rol,
    ADD COLUMN telefono VARCHAR(30) NULL COMMENT 'Celular en 10 cifras (para WhatsApp)' AFTER email,
    ADD COLUMN ciudad VARCHAR(80) NULL AFTER telefono,
    ADD COLUMN deportes JSON NULL COMMENT 'Solo jugadores: ["padel","futbol5"]' AFTER ciudad;
