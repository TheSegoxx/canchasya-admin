-- Valores agregados de la app del jugador: lista de espera, "me falta uno", clima y fidelidad.

-- Lista de espera: el jugador quiere un horario ocupado y se le avisa si se libera
CREATE TABLE esperas (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id   INT NOT NULL,
    cancha_id    INT NOT NULL,
    fecha        DATE NOT NULL,
    hora_inicio  TIME NOT NULL,
    duracion_min SMALLINT NOT NULL,
    avisado_en   DATETIME NULL COMMENT 'Cuándo se le avisó que se liberó (NULL = sigue esperando)',
    creado_en    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_esperas (usuario_id, cancha_id, fecha, hora_inicio),
    KEY idx_esperas_cancha_fecha (cancha_id, fecha),
    CONSTRAINT fk_esperas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_esperas_cancha FOREIGN KEY (cancha_id) REFERENCES canchas (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- "Me falta uno": el que reservó busca jugadores para completar el partido
CREATE TABLE partidos_abiertos (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    turno_id   INT NOT NULL,
    faltan     TINYINT NOT NULL COMMENT 'Cuántos jugadores busca',
    nivel      ENUM('cualquiera', 'principiante', 'intermedio', 'avanzado') NOT NULL DEFAULT 'cualquiera',
    comentario VARCHAR(140) NULL,
    cerrado    BOOLEAN NOT NULL DEFAULT 0 COMMENT '1 = ya no busca más',
    creado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_partidos_abiertos_turno (turno_id),
    CONSTRAINT chk_partidos_abiertos_faltan CHECK (faltan BETWEEN 1 AND 9),
    CONSTRAINT fk_partidos_abiertos_turno FOREIGN KEY (turno_id) REFERENCES turnos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE partido_jugadores (
    partido_id INT NOT NULL,
    usuario_id INT NOT NULL,
    creado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (partido_id, usuario_id),
    CONSTRAINT fk_partido_jugadores_partido FOREIGN KEY (partido_id) REFERENCES partidos_abiertos (id) ON DELETE CASCADE,
    CONSTRAINT fk_partido_jugadores_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Pronóstico por hora de cada complejo y día (Open-Meteo), guardado un rato para no pedirlo de más
CREATE TABLE clima_cache (
    complejo_id    INT NOT NULL,
    fecha          DATE NOT NULL,
    datos          JSON NOT NULL,
    actualizado_en DATETIME NOT NULL,
    PRIMARY KEY (complejo_id, fecha),
    CONSTRAINT fk_clima_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Fidelidad: cada tantos turnos jugados desde la app, un premio (turno gratis o con descuento)
ALTER TABLE complejos
    ADD COLUMN fidelidad_turnos    SMALLINT NOT NULL DEFAULT 0 COMMENT '0 = sin programa; si no, cada cuántos turnos jugados hay premio' AFTER cancelacion_horas,
    ADD COLUMN fidelidad_descuento TINYINT NOT NULL DEFAULT 100 COMMENT 'Descuento del premio en % (100 = turno gratis)' AFTER fidelidad_turnos,
    ADD CONSTRAINT chk_complejos_fidelidad CHECK (
        (fidelidad_turnos = 0 OR fidelidad_turnos BETWEEN 3 AND 30) AND fidelidad_descuento BETWEEN 10 AND 100
    );

ALTER TABLE turnos
    ADD COLUMN premio    BOOLEAN NOT NULL DEFAULT 0 COMMENT '1 = se usó un premio de fidelidad' AFTER sena_vence_en,
    ADD COLUMN descuento DECIMAL(10, 2) NOT NULL DEFAULT 0 COMMENT 'Lo que se descontó del precio por el premio' AFTER premio;
