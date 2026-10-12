-- =============================================================
-- Migración 001: turnos fijos semanales (agenda)
-- Para una base creada con una versión anterior de schema.sql.
-- No borra datos. Uso: mysql -u root < database/migraciones/001_agenda.sql
-- =============================================================

USE canchasya;

CREATE TABLE turnos_fijos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    cancha_id   INT NOT NULL,
    cliente_id  INT NOT NULL,
    dia_semana  TINYINT NOT NULL COMMENT '1 = lunes ... 7 = domingo',
    hora_inicio TIME NOT NULL,
    hora_fin    TIME NOT NULL,
    precio      DECIMAL(10, 2) NULL COMMENT 'NULL = el precio vigente de la cancha',
    fecha_desde DATE NOT NULL,
    fecha_hasta DATE NULL COMMENT 'NULL = sin fecha de fin',
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_fijos_cancha_dia (cancha_id, dia_semana),
    CONSTRAINT chk_fijos_dia CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT chk_fijos_horas CHECK (hora_inicio < hora_fin),
    CONSTRAINT fk_fijos_cancha FOREIGN KEY (cancha_id) REFERENCES canchas (id) ON DELETE CASCADE,
    CONSTRAINT fk_fijos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id)
) ENGINE=InnoDB;

ALTER TABLE turnos
    ADD COLUMN turno_fijo_id INT NULL COMMENT 'Si salió de un turno fijo' AFTER cliente_id,
    ADD UNIQUE KEY uq_turnos_fijo_fecha (turno_fijo_id, fecha),
    ADD CONSTRAINT fk_turnos_fijo FOREIGN KEY (turno_fijo_id) REFERENCES turnos_fijos (id) ON DELETE SET NULL;
