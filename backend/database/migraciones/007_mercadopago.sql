-- =============================================================
-- Migración 007: links de pago de Mercado Pago
-- No borra datos. Uso: mysql -u root < database/migraciones/007_mercadopago.sql
-- =============================================================

USE canchasya;

ALTER TABLE pagos
    MODIFY COLUMN metodo ENUM('efectivo', 'transferencia', 'mercadopago') NOT NULL;

-- Link de Checkout Pro para que el cliente pague (por ejemplo, la seña) desde el celular
CREATE TABLE links_pago (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    turno_id       INT NOT NULL,
    monto          DECIMAL(10, 2) NOT NULL,
    preferencia_id VARCHAR(80) NOT NULL COMMENT 'Id de la preferencia en Mercado Pago',
    url            VARCHAR(255) NOT NULL,
    estado         ENUM('pendiente', 'pagado', 'vencido', 'anulado') NOT NULL DEFAULT 'pendiente',
    pago_mp_id     VARCHAR(40) NULL COMMENT 'Id del pago aprobado en Mercado Pago',
    pago_id        INT NULL COMMENT 'El pago que se registró en la cuenta del turno',
    vence_en       DATETIME NOT NULL,
    creado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_links_pago_mp (pago_mp_id),
    CONSTRAINT chk_links_monto CHECK (monto > 0),
    CONSTRAINT fk_links_turno FOREIGN KEY (turno_id) REFERENCES turnos (id) ON DELETE CASCADE,
    CONSTRAINT fk_links_pago FOREIGN KEY (pago_id) REFERENCES pagos (id) ON DELETE SET NULL
) ENGINE=InnoDB;
