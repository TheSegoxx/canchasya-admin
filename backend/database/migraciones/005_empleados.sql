-- =============================================================
-- Migración 005: cuentas de empleados e invitaciones
-- No borra datos. Uso: mysql -u root < database/migraciones/005_empleados.sql
-- =============================================================

USE canchasya;

ALTER TABLE usuarios
    ADD COLUMN rol ENUM('dueno', 'empleado') NOT NULL DEFAULT 'dueno' AFTER foto_url,
    ADD COLUMN complejo_id INT NULL COMMENT 'Solo empleados: el complejo donde trabaja' AFTER rol,
    ADD CONSTRAINT fk_usuarios_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE SET NULL;

-- Código para que un empleado se una a un complejo (se guarda solo su hash)
CREATE TABLE invitaciones (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    complejo_id INT NOT NULL,
    codigo_hash CHAR(64) NOT NULL COMMENT 'SHA-256 del código',
    vence_en    DATETIME NOT NULL,
    usada_por   INT NULL,
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_invitaciones_codigo (codigo_hash),
    CONSTRAINT fk_invitaciones_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE,
    CONSTRAINT fk_invitaciones_usuario FOREIGN KEY (usada_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB;
