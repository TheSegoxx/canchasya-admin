-- =============================================================
-- Migración 011: cada pago dice si fue la seña, el pago total, el saldo o un pago parcial.
-- No borra datos. Uso: mysql -u root < database/migraciones/011_concepto_pagos.sql
-- =============================================================

USE canchasya;

ALTER TABLE pagos
    ADD COLUMN concepto ENUM('sena', 'parcial', 'saldo', 'total') NOT NULL DEFAULT 'parcial'
        COMMENT 'Se decide al registrar el pago, con lo que el turno debía en ese momento'
        AFTER metodo;

-- Los pagos que ya estaban: se calcula con el orden en que entraron y el total actual del turno
UPDATE pagos p
JOIN (
    SELECT p2.id,
           SUM(p2.monto) OVER (PARTITION BY p2.turno_id ORDER BY p2.fecha_pago, p2.id) - p2.monto AS antes,
           SUM(p2.monto) OVER (PARTITION BY p2.turno_id ORDER BY p2.fecha_pago, p2.id) AS despues,
           t.precio + (SELECT COALESCE(SUM(c.cantidad * c.precio_unitario), 0) FROM consumos c WHERE c.turno_id = t.id) AS total
    FROM pagos p2 JOIN turnos t ON t.id = p2.turno_id
) x ON x.id = p.id
SET p.concepto = CASE
    WHEN x.antes = 0 AND x.despues >= x.total THEN 'total'
    WHEN x.antes = 0 THEN 'sena'
    WHEN x.despues >= x.total THEN 'saldo'
    ELSE 'parcial'
END;
