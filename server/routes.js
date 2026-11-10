'use strict';

// Endpoints de la API. Todas las consultas son parametrizadas y todo lo que
// llega del navegador pasa por validation.js antes de tocar la base de datos.

const db = require('./db');
const engine = require('./engine');
const v = require('./validation');
const { AppError } = require('./errors');

// Las estadísticas solo se publican cuando hay suficientes experiencias
// completadas, para que un promedio nunca delate a una persona concreta.
const MIN_GROUP_SIZE = 5;
const STATS_TTL_MS = 30 * 1000;
const statsCache = new Map();

const asJson = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

function publicScenario(row) {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    profile: row.profile,
    currency: row.currency.trim(),
    start: engine.publicState(engine.initialState(row)),
  };
}

async function findActiveScenario(client, slug) {
  const { rows } = await client.query(
    `SELECT id, slug, title, description, profile, reflection, currency,
            initial_money, initial_time_minutes, initial_energy, initial_wellbeing
       FROM scenarios
      WHERE slug = $1 AND status = 'activo'`,
    [slug],
  );
  if (rows.length === 0) {
    throw new AppError(404, 'scenario_not_found', 'No encontramos ese escenario.');
  }
  return rows[0];
}

// ---------------------------------------------------------------- salud

async function health() {
  const info = await db.checkHealth();
  return { status: 200, body: { status: 'ok', database: 'conectada', activeScenarios: info.activeScenarios } };
}

// ---------------------------------------------------------------- escenarios

async function listScenarios() {
  const { rows } = await db.query(
    `SELECT slug, title, description, profile, currency,
            initial_money, initial_time_minutes, initial_energy, initial_wellbeing
       FROM scenarios
      WHERE status = 'activo'
      ORDER BY sort_order, id`,
  );
  return { status: 200, body: { scenarios: rows.map(publicScenario) } };
}

async function getScenario({ params }) {
  const slug = v.parseSlug(params.slug, 'slug');
  const scenario = await findActiveScenario(db, slug);

  const moments = await db.query(
    `SELECT id, position, kind, title, narrative, situation
       FROM moments WHERE scenario_id = $1 ORDER BY position`,
    [scenario.id],
  );
  const choices = await db.query(
    `SELECT c.id, c.moment_id, c.position, c.text, c.money_cost
       FROM choices c JOIN moments m ON m.id = c.moment_id
      WHERE m.scenario_id = $1
      ORDER BY m.position, c.position`,
    [scenario.id],
  );

  const byMoment = new Map();
  for (const c of choices.rows) {
    const list = byMoment.get(c.moment_id) || [];
    const cost = Number(c.money_cost);
    list.push({ id: c.id, position: c.position, text: c.text, cost: cost > 0 ? cost : 0 });
    byMoment.set(c.moment_id, list);
  }

  return {
    status: 200,
    body: {
      scenario: publicScenario(scenario),
      moments: moments.rows.map((m) => ({
        id: m.id,
        position: m.position,
        kind: m.kind,
        title: m.title,
        narrative: m.narrative,
        situation: m.situation,
        choices: byMoment.get(m.id) || [],
      })),
    },
  };
}

// ---------------------------------------------------------------- sesiones

async function startSession({ body }) {
  const { scenario: slug } = v.validateStartSession(body);

  return db.withTransaction(async (client) => {
    const scenario = await findActiveScenario(client, slug);
    const count = await client.query('SELECT count(*)::int AS n FROM moments WHERE scenario_id = $1', [scenario.id]);
    if (count.rows[0].n === 0) {
      throw new AppError(409, 'scenario_empty', 'Este escenario todavía no tiene momentos.');
    }
    const inserted = await client.query(
      'INSERT INTO sessions (scenario_id) VALUES ($1) RETURNING id',
      [scenario.id],
    );
    return {
      status: 201,
      body: {
        sessionId: inserted.rows[0].id,
        scenario: publicScenario(scenario),
        totalMoments: count.rows[0].n,
        state: engine.publicState(engine.initialState(scenario)),
      },
    };
  });
}

async function loadSessionForUpdate(client, sessionId) {
  const session = await client.query(
    'SELECT id, scenario_id, status FROM sessions WHERE id = $1 FOR UPDATE',
    [sessionId],
  );
  if (session.rows.length === 0) {
    throw new AppError(404, 'session_not_found', 'No encontramos esta experiencia. Puede que haya caducado: empieza una nueva.');
  }
  const s = session.rows[0];

  const scenario = (await client.query(
    `SELECT id, slug, title, reflection, currency,
            initial_money, initial_time_minutes, initial_energy, initial_wellbeing
       FROM scenarios WHERE id = $1`,
    [s.scenario_id],
  )).rows[0];

  const moments = (await client.query(
    'SELECT id, position, title FROM moments WHERE scenario_id = $1 ORDER BY position',
    [s.scenario_id],
  )).rows;

  const decided = (await client.query(
    `SELECT d.moment_id, mo.title AS moment_title, c.money_cost, c.category,
            c.time_change_minutes, c.energy_change, c.wellbeing_change,
            c.receipt_label, c.invisible_note
       FROM decisions d
       JOIN choices c  ON c.id = d.choice_id
       JOIN moments mo ON mo.id = d.moment_id
      WHERE d.session_id = $1
      ORDER BY mo.position`,
    [sessionId],
  )).rows;

  const { state, steps } = engine.replay(scenario, decided);
  return { session: s, scenario, moments, steps, state };
}

async function recordDecision({ params, body }) {
  const sessionId = v.parseUuid(params.id, 'sessionId');
  const { momentId, choiceId } = v.validateDecision(body);

  return db.withTransaction(async (client) => {
    const ctx = await loadSessionForUpdate(client, sessionId);
    if (ctx.session.status !== 'en_curso') {
      throw new AppError(409, 'session_closed', 'Esta experiencia ya terminó. Puedes empezar una nueva.');
    }

    const answered = ctx.steps.length;
    const expected = ctx.moments[answered];
    if (!expected) {
      throw new AppError(409, 'all_answered', 'Ya respondiste todos los momentos. Falta ver tu recibo.');
    }
    if (expected.id !== momentId) {
      throw new AppError(409, 'wrong_moment', 'Ese no es el momento que sigue en tu día.');
    }

    const found = await client.query(
      `SELECT id, consequence, money_cost, category, time_change_minutes,
              energy_change, wellbeing_change, receipt_label, invisible_note
         FROM choices WHERE id = $1 AND moment_id = $2`,
      [choiceId, momentId],
    );
    if (found.rows.length === 0) {
      throw new AppError(422, 'invalid_choice', 'Esa opción no pertenece a este momento.');
    }
    const choice = found.rows[0];

    if (!engine.canAfford(ctx.state, choice)) {
      throw new AppError(422, 'insufficient_money', 'El dinero disponible no alcanza para esta opción.');
    }

    await client.query(
      'INSERT INTO decisions (session_id, scenario_id, moment_id, choice_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [sessionId, ctx.session.scenario_id, momentId, choiceId],
    );

    const { state, applied } = engine.applyChoice(ctx.state, choice);
    return {
      status: 201,
      body: {
        consequence: choice.consequence,
        effects: {
          money: engine.fromCents(applied.moneyCents),
          time: applied.time,
          energy: applied.energy,
          wellbeing: applied.wellbeing,
        },
        state: engine.publicState(state),
        answered: answered + 1,
        total: ctx.moments.length,
        isLast: answered + 1 === ctx.moments.length,
      },
    };
  });
}

function resultToApi(row, scenario) {
  const visible = asJson(row.visible_summary);
  const invisible = asJson(row.invisible_summary);
  return {
    scenario: {
      slug: scenario.slug,
      title: scenario.title,
      reflection: scenario.reflection,
      currency: scenario.currency.trim(),
    },
    start: invisible.start,
    final: {
      money: Number(row.final_money),
      time: Number(row.final_time_minutes),
      energy: Number(row.final_energy),
      wellbeing: Number(row.final_wellbeing),
    },
    visible,
    invisible,
  };
}

async function completeSession({ params, body }) {
  const sessionId = v.parseUuid(params.id, 'sessionId');
  v.validateEmpty(body);

  return db.withTransaction(async (client) => {
    const ctx = await loadSessionForUpdate(client, sessionId);

    if (ctx.session.status === 'completada') {
      const stored = await client.query('SELECT * FROM session_results WHERE session_id = $1', [sessionId]);
      if (stored.rows.length === 0) {
        throw new AppError(500, 'result_missing', 'No se encontró el recibo de esta experiencia.');
      }
      return { status: 200, body: resultToApi(stored.rows[0], ctx.scenario) };
    }
    if (ctx.session.status !== 'en_curso') {
      throw new AppError(409, 'session_closed', 'Esta experiencia ya no está disponible.');
    }
    if (ctx.steps.length !== ctx.moments.length) {
      throw new AppError(409, 'incomplete', 'Todavía faltan momentos por decidir antes de ver el recibo.');
    }

    const r = engine.buildResult(ctx.scenario, ctx.steps, ctx.state);

    const saved = await client.query(
      `INSERT INTO session_results
         (session_id, final_money, final_time_minutes, final_energy, final_wellbeing,
          visible_total, income_total, time_spent_minutes, energy_spent, wellbeing_lost,
          visible_summary, invisible_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)
       RETURNING *`,
      [
        sessionId, r.final_money, r.final_time_minutes, r.final_energy, r.final_wellbeing,
        r.visible_total, r.income_total, r.time_spent_minutes, r.energy_spent, r.wellbeing_lost,
        JSON.stringify(r.visible_summary), JSON.stringify(r.invisible_summary),
      ],
    );
    await client.query(
      `UPDATE sessions SET status = 'completada', completed_at = now() WHERE id = $1 RETURNING id`,
      [sessionId],
    );

    return { status: 200, body: resultToApi(saved.rows[0], ctx.scenario) };
  });
}

// ---------------------------------------------------------------- estadísticas

async function getStats({ query }) {
  // CORRECCIÓN: En Express, query es un objeto, no un Map.
  const slugParam = query.scenario || null;
  const slug = slugParam === null ? null : v.parseSlug(slugParam);
  const cacheKey = slug || '*';

  const hit = statsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < STATS_TTL_MS) {
    return { status: 200, body: hit.body };
  }

  const scenarios = await db.query(
    `SELECT sc.id, sc.slug, sc.title,
            count(s.id) FILTER (WHERE s.status = 'completada')::int AS completed
       FROM scenarios sc
       LEFT JOIN sessions s ON s.scenario_id = sc.id
      WHERE sc.status = 'activo' AND ($1::text IS NULL OR sc.slug = $1::text)
      GROUP BY sc.id
      ORDER BY sc.sort_order, sc.id`,
    [slug],
  );
  if (slug && scenarios.rows.length === 0) {
    throw new AppError(404, 'scenario_not_found', 'No encontramos ese escenario.');
  }

  const eligibleIds = scenarios.rows.filter((r) => r.completed >= MIN_GROUP_SIZE).map((r) => r.id);
  const averages = new Map();
  const options = new Map();

  if (eligibleIds.length > 0) {
    const avg = await db.query(
      `SELECT s.scenario_id,
              avg(r.final_money)        AS final_money,
              avg(r.visible_total)      AS visible_total,
              avg(r.time_spent_minutes) AS time_spent_minutes,
              avg(r.final_time_minutes) AS final_time_minutes,
              avg(r.energy_spent)       AS energy_spent,
              avg(r.wellbeing_lost)     AS wellbeing_lost
         FROM session_results r
         JOIN sessions s ON s.id = r.session_id
        WHERE s.scenario_id = ANY($1::int[])
        GROUP BY s.scenario_id`,
      [eligibleIds],
    );
    for (const row of avg.rows) {
      averages.set(row.scenario_id, {
        finalMoney: Math.round(Number(row.final_money)),
        visibleTotal: Math.round(Number(row.visible_total)),
        timeSpentMinutes: Math.round(Number(row.time_spent_minutes)),
        finalTimeMinutes: Math.round(Number(row.final_time_minutes)),
        energySpent: Math.round(Number(row.energy_spent)),
        wellbeingLost: Math.round(Number(row.wellbeing_lost)),
      });
    }

    const dist = await db.query(
      `SELECT mo.scenario_id, mo.id AS moment_id, mo.position AS moment_position, mo.title AS moment_title,
              c.id AS choice_id, c.text, count(d.id)::int AS n
         FROM moments mo
         JOIN choices c ON c.moment_id = mo.id
         LEFT JOIN (decisions d JOIN sessions s ON s.id = d.session_id AND s.status = 'completada')
                ON d.choice_id = c.id
        WHERE mo.scenario_id = ANY($1::int[])
        GROUP BY mo.scenario_id, mo.id, mo.position, mo.title, c.id, c.position, c.text
        ORDER BY mo.scenario_id, mo.position, c.position`,
      [eligibleIds],
    );
    const completedById = new Map(scenarios.rows.map((r) => [r.id, r.completed]));
    for (const row of dist.rows) {
      const perScenario = options.get(row.scenario_id) || new Map();
      const moment = perScenario.get(row.moment_id) || {
        momentId: row.moment_id,
        position: row.moment_position,
        title: row.moment_title,
        options: [],
      };
      moment.options.push({
        choiceId: row.choice_id,
        text: row.text,
        percent: Math.round((row.n / completedById.get(row.scenario_id)) * 100),
      });
      perScenario.set(row.moment_id, moment);
      options.set(row.scenario_id, perScenario);
    }
  }

  const body = {
    minGroupSize: MIN_GROUP_SIZE,
    totalCompleted: scenarios.rows.reduce((sum, r) => sum + r.completed, 0),
    scenarios: scenarios.rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      completed: r.completed,
      hasEnoughData: r.completed >= MIN_GROUP_SIZE,
      averages: averages.get(r.id) || null,
      moments: options.has(r.id) ? [...options.get(r.id).values()] : null,
    })),
  };

  statsCache.set(cacheKey, { at: Date.now(), body });
  return { status: 200, body };
}

async function markAbandoned() {
  const { rowCount } = await db.query(
    `UPDATE sessions SET status = 'abandonada'
      WHERE status = 'en_curso' AND started_at < now() - interval '24 hours'`,
  );
  return rowCount;
}

module.exports = {
  health,
  listScenarios,
  getScenario,
  startSession,
  recordDecision,
  completeSession,
  getStats,
  markAbandoned,
  MIN_GROUP_SIZE,
};

