-- =============================================================
-- Migración 002: cobros (productos y consumos extra)
-- No borra datos. Uso: mysql -u root < database/migraciones/002_cobros.sql
-- =============================================================

USE canchasya;

CREATE TABLE productos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    complejo_id INT NOT NULL,
    nombre      VARCHAR(60) NOT NULL,
    precio      DECIMAL(10, 2) NOT NULL,
    activo      BOOLEAN NOT NULL DEFAULT 1 COMMENT '0 = ya no se ofrece (se conserva por los consumos viejos)',
    UNIQUE KEY uq_productos_nombre (complejo_id, nombre),
    CONSTRAINT chk_productos_precio CHECK (precio >= 0),
    CONSTRAINT fk_productos_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE consumos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    turno_id        INT NOT NULL,
    producto_id     INT NULL,
    descripcion     VARCHAR(60) NOT NULL,
    cantidad        SMALLINT NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_consumos_cantidad CHECK (cantidad BETWEEN 1 AND 99),
    CONSTRAINT chk_consumos_precio CHECK (precio_unitario >= 0),
    CONSTRAINT fk_consumos_turno FOREIGN KEY (turno_id) REFERENCES turnos (id) ON DELETE CASCADE,
    CONSTRAINT fk_consumos_producto FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE SET NULL
) ENGINE=InnoDB;
