-- =====================================================================
-- ESQUEMA DEFINITIVO
-- =====================================================================

CREATE TABLE IF NOT EXISTS scenarios (
    id SERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL,
    profile TEXT NOT NULL, reflection TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'activo', currency TEXT NOT NULL DEFAULT 'COP',
    initial_money NUMERIC(12,2) NOT NULL CHECK (initial_money >= 0),
    initial_time_minutes INTEGER NOT NULL CHECK (initial_time_minutes BETWEEN 0 AND 1440),
    initial_energy SMALLINT NOT NULL CHECK (initial_energy BETWEEN 0 AND 100),
    initial_wellbeing SMALLINT NOT NULL CHECK (initial_wellbeing BETWEEN 0 AND 100),
    sort_order SMALLINT NOT NULL
);

CREATE TABLE IF NOT EXISTS moments (
    id SERIAL PRIMARY KEY, scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, narrative TEXT NOT NULL, situation TEXT NOT NULL,
    CONSTRAINT uq_moment_position UNIQUE (scenario_id, position)
);

CREATE TABLE IF NOT EXISTS choices (
    id SERIAL PRIMARY KEY, moment_id INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL, text TEXT NOT NULL, money_cost NUMERIC(12,2) NOT NULL,
    category TEXT NOT NULL, time_change_minutes INTEGER NOT NULL,
    energy_change SMALLINT NOT NULL CHECK (energy_change BETWEEN -100 AND 100),
    wellbeing_change SMALLINT NOT NULL CHECK (wellbeing_change BETWEEN -100 AND 100),
    consequence TEXT NOT NULL, receipt_label TEXT, invisible_note TEXT,
    CONSTRAINT uq_choice_position UNIQUE (moment_id, position)
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), scenario_id INTEGER NOT NULL REFERENCES scenarios(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'en_curso',
    current_moment_id INTEGER REFERENCES moments(id), current_money NUMERIC(12,2),
    current_time_minutes INTEGER, current_energy SMALLINT, current_wellbeing SMALLINT
);

CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    scenario_id INTEGER REFERENCES scenarios(id) ON DELETE CASCADE,
    moment_id INTEGER NOT NULL REFERENCES moments(id), choice_id INTEGER NOT NULL REFERENCES choices(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_decision_session_moment UNIQUE (session_id, moment_id)
);

CREATE TABLE IF NOT EXISTS session_results (
    session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    final_money NUMERIC(12,2) NOT NULL, final_time_minutes INTEGER NOT NULL CHECK (final_time_minutes BETWEEN 0 AND 1440),
    final_energy SMALLINT NOT NULL CHECK (final_energy BETWEEN 0 AND 100),
    final_wellbeing SMALLINT NOT NULL CHECK (final_wellbeing BETWEEN 0 AND 100),
    visible_total NUMERIC(12,2) NOT NULL, income_total NUMERIC(12,2) NOT NULL,
    time_spent_minutes INTEGER NOT NULL, energy_spent INTEGER DEFAULT 0, wellbeing_lost INTEGER DEFAULT 0,
    visible_summary TEXT, invisible_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_decisions_moment ON decisions(moment_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scenario ON sessions(scenario_id);