-- =============================================================
-- Migración 004: fotos del complejo y de las canchas
-- No borra datos. Uso: mysql -u root < database/migraciones/004_fotos.sql
-- =============================================================

USE canchasya;

CREATE TABLE fotos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    complejo_id INT NOT NULL,
    cancha_id   INT NULL COMMENT 'NULL = foto del complejo',
    archivo     VARCHAR(40) NOT NULL COMMENT 'Nombre aleatorio en public/fotos',
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_fotos_archivo (archivo),
    KEY idx_fotos_cancha (complejo_id, cancha_id),
    CONSTRAINT fk_fotos_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE,
    CONSTRAINT fk_fotos_cancha FOREIGN KEY (cancha_id) REFERENCES canchas (id) ON DELETE CASCADE
) ENGINE=InnoDB;
