-- =============================================================
-- CanchasYa Admin: esquema de la base de datos
-- Motor: MariaDB 10.4 (XAMPP) / MySQL 8, InnoDB, utf8mb4
-- Uso: importar desde phpMyAdmin o con
--      mysql -u root < database/schema.sql
-- ATENCIÓN: borra y vuelve a crear la base "canchasya".
-- =============================================================

DROP DATABASE IF EXISTS canchasya;
CREATE DATABASE canchasya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE canchasya;

-- Dueños de complejos (único tipo de usuario de la app)
CREATE TABLE usuarios (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NULL COMMENT 'NULL si solo entra con Google',
    google_id     VARCHAR(100) NULL COMMENT 'NULL si solo usa contraseña',
    foto_url      VARCHAR(255) NULL,
    creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuarios_email (email),
    UNIQUE KEY uq_usuarios_google (google_id)
) ENGINE=InnoDB;

-- Un complejo por dueño en esta versión
CREATE TABLE complejos (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id    INT NOT NULL,
    nombre        VARCHAR(150) NOT NULL,
    direccion     VARCHAR(150) NOT NULL,
    telefono      VARCHAR(30) NULL,
    hora_apertura TIME NOT NULL,
    hora_cierre   TIME NOT NULL,
    servicios     JSON NULL COMMENT 'Ej.: ["vestuarios","buffet","estacionamiento"]',
    creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_complejos_usuario (usuario_id),
    CONSTRAINT fk_complejos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE canchas (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    complejo_id  INT NOT NULL,
    nombre       VARCHAR(50) NOT NULL,
    deporte      ENUM('padel', 'futbol5') NOT NULL,
    superficie   VARCHAR(50) NULL,
    techada      BOOLEAN NOT NULL DEFAULT 0,
    duracion_min SMALLINT NOT NULL DEFAULT 60,
    precio_base  DECIMAL(10, 2) NOT NULL,
    estado       ENUM('libre', 'ocupada') NOT NULL DEFAULT 'libre',
    habilitada   BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT chk_canchas_duracion CHECK (duracion_min IN (60, 90)),
    CONSTRAINT chk_canchas_precio CHECK (precio_base >= 0),
    CONSTRAINT fk_canchas_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Precio distinto según el horario (reemplaza al precio base en esa franja)
CREATE TABLE franjas_precio (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    cancha_id  INT NOT NULL,
    hora_desde TIME NOT NULL,
    hora_hasta TIME NOT NULL,
    precio     DECIMAL(10, 2) NOT NULL,
    CONSTRAINT chk_franjas_rango CHECK (hora_desde < hora_hasta),
    CONSTRAINT chk_franjas_precio CHECK (precio >= 0),
    CONSTRAINT fk_franjas_cancha FOREIGN KEY (cancha_id) REFERENCES canchas (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Agenda de clientes del complejo (no usan la app)
CREATE TABLE clientes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    complejo_id INT NOT NULL,
    nombre      VARCHAR(100) NOT NULL,
    telefono    VARCHAR(30) NOT NULL,
    UNIQUE KEY uq_clientes_telefono (complejo_id, telefono),
    CONSTRAINT fk_clientes_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Turno que un cliente tiene todas las semanas (mismo día, hora y cancha).
-- La API crea el turno de cada fecha la primera vez que se consulta ese día.
CREATE TABLE turnos_fijos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    cancha_id   INT NOT NULL,
    cliente_id  INT NOT NULL,
    dia_semana  TINYINT NOT NULL COMMENT '1 = lunes ... 7 = domingo',
    hora_inicio TIME NOT NULL,
    hora_fin    TIME NOT NULL,
    precio      DECIMAL(10, 2) NULL COMMENT 'NULL = el precio vigente de la cancha',
    fecha_desde DATE NOT NULL,
    fecha_hasta DATE NULL COMMENT 'NULL = sin fecha de fin',
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_fijos_cancha_dia (cancha_id, dia_semana),
    CONSTRAINT chk_fijos_dia CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT chk_fijos_horas CHECK (hora_inicio < hora_fin),
    CONSTRAINT fk_fijos_cancha FOREIGN KEY (cancha_id) REFERENCES canchas (id) ON DELETE CASCADE,
    CONSTRAINT fk_fijos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id)
) ENGINE=InnoDB;

-- Turnos cargados por el dueño. La superposición se controla en la API (transacción).
CREATE TABLE turnos (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    cancha_id     INT NOT NULL,
    cliente_id    INT NOT NULL,
    turno_fijo_id INT NULL COMMENT 'Si salió de un turno fijo',
    fecha         DATE NOT NULL,
    hora_inicio   TIME NOT NULL,
    hora_fin      TIME NOT NULL,
    precio        DECIMAL(10, 2) NOT NULL COMMENT 'Se copia al crear el turno',
    estado        ENUM('confirmado', 'cancelado', 'jugado') NOT NULL DEFAULT 'confirmado',
    estado_pago   ENUM('pendiente', 'senado', 'pagado') NOT NULL DEFAULT 'pendiente',
    creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_turnos_cancha_fecha (cancha_id, fecha),
    -- Un turno fijo genera un solo turno por fecha
    UNIQUE KEY uq_turnos_fijo_fecha (turno_fijo_id, fecha),
    CONSTRAINT chk_turnos_horas CHECK (hora_inicio < hora_fin),
    CONSTRAINT fk_turnos_cancha FOREIGN KEY (cancha_id) REFERENCES canchas (id) ON DELETE CASCADE,
    CONSTRAINT fk_turnos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id),
    CONSTRAINT fk_turnos_fijo FOREIGN KEY (turno_fijo_id) REFERENCES turnos_fijos (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Extras que se venden o alquilan en el complejo (paletas, pelotas, bebidas)
CREATE TABLE productos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    complejo_id INT NOT NULL,
    nombre      VARCHAR(60) NOT NULL,
    precio      DECIMAL(10, 2) NOT NULL,
    activo      BOOLEAN NOT NULL DEFAULT 1 COMMENT '0 = ya no se ofrece (se conserva por los consumos viejos)',
    UNIQUE KEY uq_productos_nombre (complejo_id, nombre),
    CONSTRAINT chk_productos_precio CHECK (precio >= 0),
    CONSTRAINT fk_productos_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Extras que se suman a la cuenta de un turno. Nombre y precio se copian al cargarlos.
CREATE TABLE consumos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    turno_id        INT NOT NULL,
    producto_id     INT NULL,
    descripcion     VARCHAR(60) NOT NULL,
    cantidad        SMALLINT NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_consumos_cantidad CHECK (cantidad BETWEEN 1 AND 99),
    CONSTRAINT chk_consumos_precio CHECK (precio_unitario >= 0),
    CONSTRAINT fk_consumos_turno FOREIGN KEY (turno_id) REFERENCES turnos (id) ON DELETE CASCADE,
    CONSTRAINT fk_consumos_producto FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Cobros de un turno (seña + saldo, o pago total)
CREATE TABLE pagos (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    turno_id   INT NOT NULL,
    monto      DECIMAL(10, 2) NOT NULL,
    metodo     ENUM('efectivo', 'transferencia') NOT NULL,
    fecha_pago TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_pagos_fecha (fecha_pago),
    CONSTRAINT chk_pagos_monto CHECK (monto > 0),
    CONSTRAINT fk_pagos_turno FOREIGN KEY (turno_id) REFERENCES turnos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Cancha cerrada por mantenimiento, lluvia, etc.
CREATE TABLE bloqueos (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    cancha_id INT NOT NULL,
    desde     DATETIME NOT NULL,
    hasta     DATETIME NOT NULL,
    motivo    VARCHAR(100) NOT NULL,
    CONSTRAINT chk_bloqueos_rango CHECK (desde < hasta),
    CONSTRAINT fk_bloqueos_cancha FOREIGN KEY (cancha_id) REFERENCES canchas (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seguridad: códigos para recuperar la contraseña
CREATE TABLE codigos_recuperacion (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id  INT NOT NULL,
    codigo_hash VARCHAR(255) NOT NULL,
    vence_en    DATETIME NOT NULL,
    usado       BOOLEAN NOT NULL DEFAULT 0,
    CONSTRAINT fk_codigos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seguridad: límite de intentos de login por IP
CREATE TABLE intentos_login (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    ip      VARCHAR(45) NOT NULL,
    momento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_intentos_ip_momento (ip, momento)
) ENGINE=InnoDB;
