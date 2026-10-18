-- Reservas desde la app del jugador: cada complejo decide si las toma, si cobra seña y con qué plazos.
-- Los turnos que reserva un jugador guardan quién fue, la seña que tiene que pagar y hasta cuándo.

ALTER TABLE complejos
    ADD COLUMN reservas_online   BOOLEAN NOT NULL DEFAULT 1 COMMENT '1 = los jugadores pueden reservar desde la app' AFTER visible,
    ADD COLUMN sena_porcentaje   TINYINT NOT NULL DEFAULT 0 COMMENT 'Seña para reservar: % del total (0 = sin seña)' AFTER reservas_online,
    ADD COLUMN sena_minutos      SMALLINT NOT NULL DEFAULT 30 COMMENT 'Minutos para pagar la seña antes de que se libere el horario' AFTER sena_porcentaje,
    ADD COLUMN reserva_dias      SMALLINT NOT NULL DEFAULT 14 COMMENT 'Hasta cuántos días antes se puede reservar' AFTER sena_minutos,
    ADD COLUMN cancelacion_horas SMALLINT NOT NULL DEFAULT 24 COMMENT 'El jugador puede cancelar hasta estas horas antes' AFTER reserva_dias,
    ADD CONSTRAINT chk_complejos_reservas CHECK (
        sena_porcentaje BETWEEN 0 AND 100 AND sena_minutos BETWEEN 5 AND 1440
        AND reserva_dias BETWEEN 1 AND 90 AND cancelacion_horas BETWEEN 0 AND 168
    );

ALTER TABLE turnos
    ADD COLUMN usuario_id    INT NULL COMMENT 'El jugador que lo reservó desde la app (NULL = lo cargó el complejo)' AFTER turno_fijo_id,
    ADD COLUMN sena          DECIMAL(10, 2) NULL COMMENT 'Seña que pide el complejo para confirmar la reserva' AFTER precio,
    ADD COLUMN sena_vence_en DATETIME NULL COMMENT 'Si a esa hora no se pagó la seña, la reserva se cancela sola' AFTER sena,
    ADD KEY idx_turnos_usuario (usuario_id, fecha),
    ADD KEY idx_turnos_sena_vence (sena_vence_en),
    ADD CONSTRAINT fk_turnos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL;
