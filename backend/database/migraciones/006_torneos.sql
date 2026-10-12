-- =============================================================
-- Migración 006: torneos y ligas
-- No borra datos. Uso: mysql -u root < database/migraciones/006_torneos.sql
-- =============================================================

USE canchasya;

-- Torneos y ligas del complejo
CREATE TABLE torneos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    complejo_id INT NOT NULL,
    nombre      VARCHAR(100) NOT NULL,
    deporte     ENUM('padel', 'futbol5') NOT NULL,
    formato     ENUM('liga', 'eliminacion') NOT NULL COMMENT 'liga = todos contra todos',
    estado      ENUM('inscripcion', 'en_curso', 'finalizado') NOT NULL DEFAULT 'inscripcion',
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_torneos_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Equipos (fútbol 5) o parejas (pádel) inscriptos
CREATE TABLE torneo_equipos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    torneo_id   INT NOT NULL,
    nombre      VARCHAR(60) NOT NULL,
    integrantes VARCHAR(150) NULL,
    telefono    VARCHAR(20) NULL COMMENT 'Contacto, normalizado como el de los clientes',
    UNIQUE KEY uq_equipos_nombre (torneo_id, nombre),
    CONSTRAINT fk_equipos_torneo FOREIGN KEY (torneo_id) REFERENCES torneos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Partidos del fixture. En eliminación se crean todas las rondas al sortear
-- y los equipos de las rondas siguientes se completan a medida que hay ganadores.
CREATE TABLE partidos (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    torneo_id           INT NOT NULL,
    ronda               TINYINT NOT NULL COMMENT 'Fecha (liga) o ronda (eliminación), desde 1',
    orden               SMALLINT NOT NULL COMMENT 'Posición dentro de la ronda, desde 0',
    local_id            INT NULL,
    visitante_id        INT NULL,
    resultado_local     SMALLINT NULL,
    resultado_visitante SMALLINT NULL,
    ganador_id          INT NULL,
    cancha_id           INT NULL,
    fecha               DATE NULL,
    hora                TIME NULL,
    bloqueo_id          INT NULL COMMENT 'Bloqueo de la agenda que reserva la cancha para el partido',
    UNIQUE KEY uq_partidos_posicion (torneo_id, ronda, orden),
    CONSTRAINT chk_partidos_resultado CHECK (resultado_local >= 0 AND resultado_visitante >= 0),
    CONSTRAINT fk_partidos_torneo FOREIGN KEY (torneo_id) REFERENCES torneos (id) ON DELETE CASCADE,
    CONSTRAINT fk_partidos_local FOREIGN KEY (local_id) REFERENCES torneo_equipos (id),
    CONSTRAINT fk_partidos_visitante FOREIGN KEY (visitante_id) REFERENCES torneo_equipos (id),
    CONSTRAINT fk_partidos_ganador FOREIGN KEY (ganador_id) REFERENCES torneo_equipos (id),
    CONSTRAINT fk_partidos_cancha FOREIGN KEY (cancha_id) REFERENCES canchas (id) ON DELETE SET NULL,
    CONSTRAINT fk_partidos_bloqueo FOREIGN KEY (bloqueo_id) REFERENCES bloqueos (id) ON DELETE SET NULL
) ENGINE=InnoDB;
