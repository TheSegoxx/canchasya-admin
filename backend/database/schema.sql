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

-- Jugadores (los clientes que reservan), dueños de complejos y sus empleados
CREATE TABLE usuarios (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL,
    telefono      VARCHAR(30) NULL COMMENT 'Celular en 10 cifras (para WhatsApp)',
    ciudad        VARCHAR(80) NULL,
    deportes      JSON NULL COMMENT 'Solo jugadores: ["padel","futbol5"]',
    password_hash VARCHAR(255) NULL COMMENT 'NULL si solo entra con Google',
    google_id     VARCHAR(100) NULL COMMENT 'NULL si solo usa contraseña',
    foto_url      VARCHAR(255) NULL,
    rol           ENUM('dueno', 'empleado', 'jugador') NOT NULL DEFAULT 'dueno',
    rol_elegido   BOOLEAN NOT NULL DEFAULT 1 COMMENT '0 = entró con Google y todavía no eligió si es jugador o dueño',
    complejo_id   INT NULL COMMENT 'Solo empleados: el complejo donde trabaja (FK más abajo)',
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
    ciudad        VARCHAR(80) NULL,
    latitud       DECIMAL(9, 6) NULL,
    longitud      DECIMAL(9, 6) NULL,
    telefono      VARCHAR(30) NULL,
    hora_apertura TIME NOT NULL,
    hora_cierre   TIME NOT NULL,
    servicios     JSON NULL COMMENT 'Ej.: ["vestuarios","buffet","estacionamiento"]',
    visible       BOOLEAN NOT NULL DEFAULT 1 COMMENT '1 = aparece en la búsqueda de los jugadores',
    creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_complejos_usuario (usuario_id),
    CONSTRAINT chk_complejos_ubicacion CHECK (
        (latitud IS NULL AND longitud IS NULL)
        OR (latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180)
    ),
    CONSTRAINT fk_complejos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- La FK de usuarios.complejo_id va acá porque complejos se crea después que usuarios
ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE SET NULL;

-- Complejos que un jugador guardó como favoritos
CREATE TABLE favoritos (
    usuario_id  INT NOT NULL,
    complejo_id INT NOT NULL,
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, complejo_id),
    CONSTRAINT fk_favoritos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_favoritos_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Código para que un empleado se una a un complejo (se guarda solo su hash)
CREATE TABLE invitaciones (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    complejo_id INT NOT NULL,
    codigo_hash CHAR(64) NOT NULL COMMENT 'SHA-256 del código',
    vence_en    DATETIME NOT NULL,
    usada_por   INT NULL,
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_invitaciones_codigo (codigo_hash),
    CONSTRAINT fk_invitaciones_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE,
    CONSTRAINT fk_invitaciones_usuario FOREIGN KEY (usada_por) REFERENCES usuarios (id) ON DELETE SET NULL
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

-- Fotos del complejo (cancha_id NULL) y de cada cancha; el archivo está en public/fotos
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
    metodo     ENUM('efectivo', 'transferencia', 'mercadopago') NOT NULL,
    concepto   ENUM('sena', 'parcial', 'saldo', 'total') NOT NULL DEFAULT 'parcial'
               COMMENT 'Se decide al registrar el pago, con lo que el turno debía en ese momento',
    fecha_pago TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_pagos_fecha (fecha_pago),
    CONSTRAINT chk_pagos_monto CHECK (monto > 0),
    CONSTRAINT fk_pagos_turno FOREIGN KEY (turno_id) REFERENCES turnos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

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

-- Gastos y otros ingresos que el dueño carga a mano (lo cobrado por turnos sale de pagos)
CREATE TABLE movimientos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    complejo_id INT NOT NULL,
    tipo        ENUM('ingreso', 'egreso') NOT NULL,
    categoria   VARCHAR(30) NOT NULL COMMENT 'Categoría principal (el reparto está en movimiento_categorias)',
    descripcion VARCHAR(100) NULL,
    monto       DECIMAL(10, 2) NOT NULL,
    metodo      ENUM('efectivo', 'transferencia') NOT NULL,
    fecha       DATE NOT NULL,
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_movimientos_fecha (complejo_id, fecha),
    CONSTRAINT chk_movimientos_monto CHECK (monto > 0),
    CONSTRAINT fk_movimientos_complejo FOREIGN KEY (complejo_id) REFERENCES complejos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Cómo se reparte el monto de un movimiento entre sus categorías (suman el monto del movimiento)
CREATE TABLE movimiento_categorias (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    movimiento_id INT NOT NULL,
    categoria     VARCHAR(30) NOT NULL COMMENT 'Clave fija de la API (sueldos, servicios, ventas...)',
    monto         DECIMAL(10, 2) NOT NULL,
    UNIQUE KEY uq_movimiento_categoria (movimiento_id, categoria),
    CONSTRAINT chk_movimiento_categorias_monto CHECK (monto > 0),
    CONSTRAINT fk_movimiento_categorias FOREIGN KEY (movimiento_id) REFERENCES movimientos (id) ON DELETE CASCADE
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

-- Seguridad: códigos para recuperar la contraseña
CREATE TABLE codigos_recuperacion (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id  INT NOT NULL,
    codigo_hash VARCHAR(255) NOT NULL,
    vence_en    DATETIME NOT NULL,
    intentos    TINYINT NOT NULL DEFAULT 0 COMMENT 'Fallidos: a los 5 el código deja de servir',
    usado       BOOLEAN NOT NULL DEFAULT 0,
    creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_codigos_usuario (usuario_id, usado, vence_en),
    CONSTRAINT fk_codigos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Notificaciones push: celulares de cada usuario (token de FCM)
CREATE TABLE dispositivos (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id     INT NOT NULL,
    token          VARCHAR(512) CHARACTER SET ascii NOT NULL,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dispositivos_token (token),
    CONSTRAINT fk_dispositivos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Avisos automáticos ya mandados (recordatorios, resumen del día), para no repetirlos
CREATE TABLE avisos_enviados (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    tipo       VARCHAR(30) NOT NULL,
    referencia VARCHAR(50) NOT NULL,
    enviado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_avisos (tipo, referencia)
) ENGINE=InnoDB;

-- Seguridad: límite de intentos de login por IP
CREATE TABLE intentos_login (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    ip      VARCHAR(45) NOT NULL,
    momento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_intentos_ip_momento (ip, momento)
) ENGINE=InnoDB;
