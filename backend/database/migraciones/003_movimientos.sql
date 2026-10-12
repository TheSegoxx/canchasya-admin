-- =============================================================
-- Migración 003: movimientos de caja cargados a mano (gastos y otros ingresos)
-- No borra datos. Uso: mysql -u root < database/migraciones/003_movimientos.sql
-- =============================================================

USE canchasya;

CREATE TABLE movimientos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    complejo_id INT NOT NULL,
    tipo        ENUM('ingreso', 'egreso') NOT NULL,
    categoria   VARCHAR(30) NOT NULL COMMENT 'Clave fija de la API (sueldos, servicios, ventas...)',
    descripcion VARCHAR(100) NULL,
    monto       DECIMAL(10, 2) NOT NULL,
    metodo      ENUM('efectivo', 'transferencia') NOT NULL,
    fecha       DATE NOT NULL,
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_movimientos_fecha (complejo_id, fecha),
    CONSTRAINT chk_movimientos_monto CHECK (monto > 0),
    CONSTRAINT fk_movimientos_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE
) ENGINE=InnoDB;
