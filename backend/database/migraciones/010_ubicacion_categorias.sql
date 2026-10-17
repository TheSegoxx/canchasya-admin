-- =============================================================
-- Migración 010: ubicación del complejo y varias categorías por gasto o ingreso.
-- No borra datos. Uso: mysql -u root < database/migraciones/010_ubicacion_categorias.sql
-- =============================================================

USE canchasya;

-- Ubicación del complejo (para "Cómo llegar" y, más adelante, la búsqueda por cercanía)
ALTER TABLE complejos
    ADD COLUMN ciudad   VARCHAR(80) NULL AFTER direccion,
    ADD COLUMN latitud  DECIMAL(9, 6) NULL AFTER ciudad,
    ADD COLUMN longitud DECIMAL(9, 6) NULL AFTER latitud,
    ADD CONSTRAINT chk_complejos_ubicacion CHECK (
        (latitud IS NULL AND longitud IS NULL)
        OR (latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180)
    );

-- Cómo se reparte el monto de un movimiento entre sus categorías (suman el monto del movimiento).
-- movimientos.categoria queda como la categoría principal (la de mayor monto).
CREATE TABLE movimiento_categorias (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    movimiento_id INT NOT NULL,
    categoria     VARCHAR(30) NOT NULL,
    monto         DECIMAL(10, 2) NOT NULL,
    UNIQUE KEY uq_movimiento_categoria (movimiento_id, categoria),
    CONSTRAINT chk_movimiento_categorias_monto CHECK (monto > 0),
    CONSTRAINT fk_movimiento_categorias FOREIGN KEY (movimiento_id) REFERENCES movimientos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Los movimientos que ya estaban tienen una sola categoría con todo el monto
INSERT INTO movimiento_categorias (movimiento_id, categoria, monto)
SELECT id, categoria, monto FROM movimientos;
