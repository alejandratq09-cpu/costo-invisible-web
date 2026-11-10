-- =====================================================================
-- El costo invisible de llegar al final del día
-- Esquema PostgreSQL 13+ (compatible con PG 18)
--
-- Principios:
--   * Anonimato: no hay columnas para nombres, correos ni IP.
--   * Dinero en NUMERIC (decimal exacto).
--   * Llaves foráneas compuestas reales para garantizar integridad.
--   * Script idempotente (se puede ejecutar más de una vez sin fallar).
-- =====================================================================

-- 1. Sesiones anónimas
CREATE TABLE IF NOT EXISTS sesiones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iniciada_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalizada_en   TIMESTAMPTZ,
    CONSTRAINT sesion_fin_posterior CHECK (
        finalizada_en IS NULL OR finalizada_en >= iniciada_en
    )
);

-- 2. Momentos del día
-- Usamos TEXT como ID para legibilidad (en vez de números).
CREATE TABLE IF NOT EXISTS momentos (
    id          TEXT PRIMARY KEY,
    etiqueta    TEXT NOT NULL,
    orden       SMALLINT NOT NULL UNIQUE
);

-- 3. Opciones de decisión
CREATE TABLE IF NOT EXISTS opciones (
    id          TEXT PRIMARY KEY,
    etiqueta    TEXT NOT NULL,
    costo       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (costo >= 0)
);

-- 4. TABLA PUENTE (Sesiones x Momentos)
-- Esto permite la llave foránea compuesta. Garantiza que no se registre
-- una decisión en un momento que la sesión no haya abierto.
CREATE TABLE IF NOT EXISTS sesion_momentos (
    sesion_id   UUID NOT NULL,
    momento_id  TEXT NOT NULL,
    abierto_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sesion_id, momento_id),
    CONSTRAINT fk_sm_sesion FOREIGN KEY (sesion_id) REFERENCES sesiones(id) ON DELETE CASCADE,
    CONSTRAINT fk_sm_momento FOREIGN KEY (momento_id) REFERENCES momentos(id)
);

-- 5. Decisiones
-- Usa FK compuesta (sesion_id, momento_id) apuntando a sesion_momentos.
CREATE TABLE IF NOT EXISTS decisiones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id       UUID NOT NULL,
    momento_id      TEXT NOT NULL,
    opcion_id       TEXT NOT NULL,
    costo           NUMERIC(12,2) NOT NULL CHECK (costo >= 0),
    registrada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- FK compuesta real
    CONSTRAINT fk_decision_sesion_momento 
        FOREIGN KEY (sesion_id, momento_id) 
        REFERENCES sesion_momentos(sesion_id, momento_id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_decision_opcion 
        FOREIGN KEY (opcion_id) REFERENCES opciones(id),

    -- Un momento por sesión
    CONSTRAINT uq_decision_sesion_momento UNIQUE (sesion_id, momento_id)
);

-- 6. Resultados de la sesión (El "recibo invisible")
CREATE TABLE IF NOT EXISTS resultados_sesion (
    sesion_id           UUID PRIMARY KEY REFERENCES sesiones(id) ON DELETE CASCADE,
    dinero_final        NUMERIC(12,2) NOT NULL,
    tiempo_final_min    INTEGER NOT NULL CHECK (tiempo_final_min BETWEEN 0 AND 1440),
    energia_final       SMALLINT NOT NULL CHECK (energia_final BETWEEN 0 AND 100),
    bienestar_final     SMALLINT NOT NULL CHECK (bienestar_final BETWEEN 0 AND 100),
    total_visible       NUMERIC(12,2) NOT NULL CHECK (total_visible >= 0),
    ingreso_total       NUMERIC(12,2) NOT NULL CHECK (ingreso_total >= 0),
    tiempo_invertido_min INTEGER NOT NULL CHECK (tiempo_invertido_min >= 0)
);

-- 7. Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_decisiones_sesion  ON decisiones(sesion_id);
CREATE INDEX IF NOT EXISTS idx_decisiones_momento ON decisiones(momento_id);
CREATE INDEX IF NOT EXISTS idx_decisiones_opcion  ON decisiones(opcion_id);

-- 8. SEED DATA (Datos iniciales)
-- ON CONFLICT asegura que no falle si se corre varias veces.
INSERT INTO momentos (id, etiqueta, orden) VALUES
    ('manana',   'Mañana',   1),
    ('mediodia', 'Mediodía', 2),
    ('tarde',    'Tarde',    3),
    ('noche',    'Noche',    4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO opciones (id, etiqueta, costo) VALUES
    ('terminar',  'Terminar la tarea', 0.00),
    ('descansar', 'Descansar',         0.00),
    ('posponer',  'Posponer',          0.00)
ON CONFLICT (id) DO NOTHING;
