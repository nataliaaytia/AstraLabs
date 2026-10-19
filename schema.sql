-- =====================================================================
-- Sistema de Gestión de Inventario — Casa Amandita del Adulto Mayor
-- Esquema de base de datos (PostgreSQL)
-- =====================================================================

-- ---------- Seguridad y usuarios (RF-25, RF-26) ----------

CREATE TABLE roles (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(50) NOT NULL UNIQUE,  -- Administradora, Recepcion, Almacen_Cocina
    descripcion     TEXT
);

CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(120) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol_id          INTEGER NOT NULL REFERENCES roles(id),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Catálogo (RF-01, RF-07) ----------

CREATE TABLE categorias (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(80) NOT NULL UNIQUE  -- Alimentos, Medicinas, Ropa, Mobiliario/Otros
);

CREATE TABLE articulos (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    categoria_id    INTEGER NOT NULL REFERENCES categorias(id),
    unidad_medida   VARCHAR(30) NOT NULL,         -- kg, unidad, litro, caja, etc.
    es_perecedero   BOOLEAN NOT NULL DEFAULT FALSE,
    stock_minimo    NUMERIC(12,2) NOT NULL DEFAULT 0,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (nombre, categoria_id)
);

CREATE INDEX idx_articulos_categoria ON articulos(categoria_id);

-- ---------- Donaciones (RF-14, RF-15) ----------

CREATE TABLE donantes (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('persona', 'empresa')),
    contacto        VARCHAR(150),
    telefono        VARCHAR(30),
    email           VARCHAR(150),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Lotes (RF-04, base del FEFO) ----------

CREATE TABLE lotes (
    id                   SERIAL PRIMARY KEY,
    articulo_id          INTEGER NOT NULL REFERENCES articulos(id),
    numero_lote          VARCHAR(50),
    fecha_vencimiento     DATE,                    -- NULL si el artículo no es perecedero
    donante_id           INTEGER REFERENCES donantes(id),
    cantidad_inicial     NUMERIC(12,2) NOT NULL CHECK (cantidad_inicial >= 0),
    cantidad_disponible  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
    fecha_ingreso        DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FEFO: para encontrar rápido el lote más próximo a vencer con stock disponible
CREATE INDEX idx_lotes_fefo ON lotes(articulo_id, fecha_vencimiento)
    WHERE cantidad_disponible > 0;

-- ---------- Movimientos / Kardex (RF-02, RF-03, RF-06, RF-08, RF-09) ----------

CREATE TABLE movimientos (
    id              SERIAL PRIMARY KEY,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'merma', 'excedente', 'ajuste')),
    articulo_id     INTEGER NOT NULL REFERENCES articulos(id),
    cantidad_total  NUMERIC(12,2) NOT NULL CHECK (cantidad_total > 0),
    fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    donante_id      INTEGER REFERENCES donantes(id),         -- solo aplica a tipo='entrada'
    motivo          VARCHAR(50),                              -- vencimiento, deterioro, perdida (mermas)
    destino         VARCHAR(100),                              -- area/consumo (salidas) o destino de excedente
    observaciones   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movimientos_articulo_fecha ON movimientos(articulo_id, fecha);
CREATE INDEX idx_movimientos_tipo ON movimientos(tipo);

-- Detalle: de qué lote(s) exactos se tomó o a qué lote entró el movimiento.
-- Una salida puede repartirse entre varios lotes siguiendo FEFO.
CREATE TABLE movimiento_lotes (
    id              SERIAL PRIMARY KEY,
    movimiento_id   INTEGER NOT NULL REFERENCES movimientos(id) ON DELETE CASCADE,
    lote_id         INTEGER NOT NULL REFERENCES lotes(id),
    cantidad        NUMERIC(12,2) NOT NULL CHECK (cantidad > 0)
);

CREATE INDEX idx_movimiento_lotes_lote ON movimiento_lotes(lote_id);

-- ---------- Alertas y notificaciones (RF-10, RF-11, RF-12, RF-13) ----------

CREATE TABLE alertas (
    id                  SERIAL PRIMARY KEY,
    tipo                VARCHAR(20) NOT NULL CHECK (tipo IN ('vencimiento', 'stock_minimo')),
    articulo_id         INTEGER NOT NULL REFERENCES articulos(id),
    lote_id             INTEGER REFERENCES lotes(id),          -- solo aplica a tipo='vencimiento'
    fecha_generada      TIMESTAMPTZ NOT NULL DEFAULT now(),
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'atendida')),
    fecha_atendida      TIMESTAMPTZ,
    usuario_atiende_id  INTEGER REFERENCES usuarios(id)
);

CREATE INDEX idx_alertas_estado ON alertas(estado, tipo);

CREATE TABLE notificaciones_enviadas (
    id              SERIAL PRIMARY KEY,
    alerta_id       INTEGER NOT NULL REFERENCES alertas(id),
    canal           VARCHAR(20) NOT NULL DEFAULT 'email',
    destinatario    VARCHAR(150) NOT NULL,
    fecha_envio     TIMESTAMPTZ NOT NULL DEFAULT now(),
    estado_envio    VARCHAR(20) NOT NULL DEFAULT 'enviado' CHECK (estado_envio IN ('enviado', 'fallido'))
);

-- ---------- Plan de comidas (RF-16 a RF-20) ----------

CREATE TABLE menus (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    descripcion     TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_ingredientes (
    id                      SERIAL PRIMARY KEY,
    menu_id                 INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    articulo_id             INTEGER NOT NULL REFERENCES articulos(id),
    cantidad_por_porcion    NUMERIC(12,3) NOT NULL CHECK (cantidad_por_porcion > 0),
    UNIQUE (menu_id, articulo_id)
);

CREATE TABLE planes_comida (
    id              SERIAL PRIMARY KEY,
    fecha           DATE NOT NULL,
    tipo_comida     VARCHAR(20) NOT NULL CHECK (tipo_comida IN ('desayuno', 'merienda', 'almuerzo')),
    menu_id         INTEGER NOT NULL REFERENCES menus(id),
    comensales      INTEGER NOT NULL CHECK (comensales > 0),
    estado          VARCHAR(20) NOT NULL DEFAULT 'planificado' CHECK (estado IN ('planificado', 'confirmado', 'cancelado')),
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    movimiento_salida_id INTEGER REFERENCES movimientos(id),  -- se llena al confirmar (RF-19)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (fecha, tipo_comida)
);

-- Snapshot del cálculo de faltantes al momento de planificar (RF-18)
CREATE TABLE plan_consumo (
    id                  SERIAL PRIMARY KEY,
    plan_id             INTEGER NOT NULL REFERENCES planes_comida(id) ON DELETE CASCADE,
    articulo_id         INTEGER NOT NULL REFERENCES articulos(id),
    cantidad_requerida  NUMERIC(12,3) NOT NULL,
    cantidad_faltante   NUMERIC(12,3) NOT NULL DEFAULT 0
);

-- ---------- Auditoría (RF-27) ----------

CREATE TABLE bitacora_auditoria (
    id              BIGSERIAL PRIMARY KEY,
    usuario_id      INTEGER REFERENCES usuarios(id),
    accion          VARCHAR(50) NOT NULL,      -- crear, editar, eliminar, confirmar, etc.
    entidad         VARCHAR(50) NOT NULL,      -- articulo, movimiento, plan_comida, etc.
    entidad_id      INTEGER,
    detalle         JSONB,
    fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bitacora_entidad ON bitacora_auditoria(entidad, entidad_id);

-- ---------- Migración (RF-28) ----------

CREATE TABLE importaciones_excel (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    archivo_nombre  VARCHAR(255) NOT NULL,
    fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
    filas_importadas INTEGER NOT NULL DEFAULT 0,
    filas_error     INTEGER NOT NULL DEFAULT 0,
    estado          VARCHAR(20) NOT NULL DEFAULT 'procesando' CHECK (estado IN ('procesando', 'completado', 'con_errores'))
);

-- ---------- Configuración (umbrales globales, ej. días de anticipación) ----------

CREATE TABLE configuracion (
    clave           VARCHAR(80) PRIMARY KEY,
    valor           VARCHAR(255) NOT NULL,
    descripcion     TEXT
);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
    ('dias_anticipacion_vencimiento', '7', 'Días de anticipación para alertar productos próximos a vencer (RF-10)');

-- =====================================================================
-- VISTA: stock disponible por artículo (RF-05 — stock siempre al día)
-- =====================================================================

CREATE VIEW vw_stock_articulo AS
SELECT
    a.id            AS articulo_id,
    a.nombre        AS articulo,
    a.stock_minimo,
    COALESCE(SUM(l.cantidad_disponible), 0) AS stock_actual
FROM articulos a
LEFT JOIN lotes l ON l.articulo_id = a.id
GROUP BY a.id, a.nombre, a.stock_minimo;

-- =====================================================================
-- VISTA: kardex (RF-08) — historial de movimientos con detalle de lote
-- =====================================================================

CREATE VIEW vw_kardex AS
SELECT
    m.id            AS movimiento_id,
    m.tipo,
    a.nombre        AS articulo,
    ml.cantidad,
    l.numero_lote,
    l.fecha_vencimiento,
    m.fecha,
    u.nombre        AS usuario,
    m.motivo,
    m.destino
FROM movimientos m
JOIN articulos a ON a.id = m.articulo_id
JOIN usuarios u ON u.id = m.usuario_id
LEFT JOIN movimiento_lotes ml ON ml.movimiento_id = m.id
LEFT JOIN lotes l ON l.id = ml.lote_id
ORDER BY m.fecha DESC;

-- =====================================================================
-- TRIGGER: actualizar cantidad_disponible del lote según el movimiento
-- (el Gestor de Inventario y FEFO es el único que inserta en movimiento_lotes)
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_actualizar_stock_lote()
RETURNS TRIGGER AS $$
DECLARE
    v_tipo VARCHAR(20);
BEGIN
    SELECT tipo INTO v_tipo FROM movimientos WHERE id = NEW.movimiento_id;

    IF v_tipo = 'entrada' THEN
        UPDATE lotes
        SET cantidad_disponible = cantidad_disponible + NEW.cantidad
        WHERE id = NEW.lote_id;
    ELSIF v_tipo IN ('salida', 'merma', 'excedente') THEN
        UPDATE lotes
        SET cantidad_disponible = cantidad_disponible - NEW.cantidad
        WHERE id = NEW.lote_id;

        IF (SELECT cantidad_disponible FROM lotes WHERE id = NEW.lote_id) < 0 THEN
            RAISE EXCEPTION 'Stock insuficiente en el lote % para este movimiento', NEW.lote_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimiento_lote_stock
AFTER INSERT ON movimiento_lotes
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_stock_lote();

-- =====================================================================
-- Datos semilla: roles base
-- =====================================================================

INSERT INTO roles (nombre, descripcion) VALUES
    ('Administradora', 'Administra el sistema, consulta reportes y configura umbrales'),
    ('Recepcion', 'Registra donaciones y asigna lotes'),
    ('Almacen_Cocina', 'Registra salidas, mermas y planes de comidas');

INSERT INTO categorias (nombre) VALUES
    ('Alimentos'), ('Medicinas'), ('Ropa'), ('Mobiliario/Otros');
