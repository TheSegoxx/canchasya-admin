-- =============================================================
-- Migración 009: notificaciones push (Firebase Cloud Messaging)
-- No borra datos. Uso: mysql -u root < database/migraciones/009_notificaciones.sql
-- =============================================================

USE canchasya;

-- Celulares donde cada usuario recibe las notificaciones (token de FCM)
CREATE TABLE dispositivos (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id     INT NOT NULL,
    token          VARCHAR(512) CHARACTER SET ascii NOT NULL,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dispositivos_token (token),
    CONSTRAINT fk_dispositivos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Avisos automáticos ya mandados (recordatorios, resumen del día), para no repetirlos
CREATE TABLE avisos_enviados (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    tipo       VARCHAR(30) NOT NULL,
    referencia VARCHAR(50) NOT NULL,
    enviado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_avisos (tipo, referencia)
) ENGINE=InnoDB;
