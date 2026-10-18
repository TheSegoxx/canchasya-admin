-- La vaquita: el jugador que reservó divide lo que falta pagar entre los amigos.
-- Cada parte tiene su propio link de Mercado Pago; cuando se paga, entra a la cuenta del turno.

CREATE TABLE vaquita_partes (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    turno_id        INT NOT NULL,
    link_id         INT NULL COMMENT 'El link de Mercado Pago de esta parte',
    nombre          VARCHAR(40) NOT NULL,
    monto           DECIMAL(10, 2) NOT NULL,
    es_organizador  BOOLEAN NOT NULL DEFAULT 0 COMMENT '1 = la parte del jugador que reservó',
    anulada         BOOLEAN NOT NULL DEFAULT 0 COMMENT '1 = se deshizo la vaquita antes de que la pagaran',
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_vaquita_turno (turno_id),
    UNIQUE KEY uq_vaquita_link (link_id),
    CONSTRAINT chk_vaquita_monto CHECK (monto > 0),
    CONSTRAINT fk_vaquita_turno FOREIGN KEY (turno_id) REFERENCES turnos (id) ON DELETE CASCADE,
    CONSTRAINT fk_vaquita_link FOREIGN KEY (link_id) REFERENCES links_pago (id) ON DELETE SET NULL
) ENGINE=InnoDB;
