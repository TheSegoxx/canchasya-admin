-- =============================================================
-- Migración 008: recuperar la contraseña con un código por email
-- No borra datos. Uso: mysql -u root < database/migraciones/008_recuperacion.sql
-- =============================================================

USE canchasya;

-- Intentos fallidos con cada código (a los 5 deja de servir) y cuándo se pidió
-- (para no mandar más de un correo por minuto a la misma cuenta)
ALTER TABLE codigos_recuperacion
    ADD COLUMN intentos  TINYINT NOT NULL DEFAULT 0 AFTER vence_en,
    ADD COLUMN creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD KEY idx_codigos_usuario (usuario_id, usado, vence_en);
