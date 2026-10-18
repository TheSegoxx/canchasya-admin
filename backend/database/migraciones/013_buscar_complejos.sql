-- =============================================================
-- Migración 013: los jugadores buscan complejos.
-- El dueño decide si su complejo aparece en la búsqueda, y el jugador guarda sus favoritos.
-- No borra datos. Uso: mysql -u root < database/migraciones/013_buscar_complejos.sql
-- =============================================================

USE canchasya;

ALTER TABLE complejos
    ADD COLUMN visible BOOLEAN NOT NULL DEFAULT 1
        COMMENT '1 = aparece en la búsqueda de los jugadores' AFTER servicios;

CREATE TABLE favoritos (
    usuario_id  INT NOT NULL,
    complejo_id INT NOT NULL,
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, complejo_id),
    CONSTRAINT fk_favoritos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_favoritos_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE
) ENGINE=InnoDB;
