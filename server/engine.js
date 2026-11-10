'use strict';

// Lógica pura del juego: cómo cambian los indicadores con cada opción y cómo
// se arma el "recibo invisible". No toca la base de datos, así que se puede
// probar sola (ver test/engine.test.js).
//
// El dinero se maneja en centavos enteros para evitar errores de punto
// flotante; la base de datos lo guarda como NUMERIC.

const ENERGY_MAX = 100;
const WELLBEING_MAX = 100;
const TIME_MAX = 1440;

const CATEGORY_LABELS = {
  alimentacion: 'Alimentación',
  transporte: 'Transporte',
  salud: 'Salud',
  trabajo_estudio: 'Trabajo y estudio',
  hogar: 'Hogar',
  otros: 'Otros',
};

const toCents = (value) => Math.round(Number(value) * 100);
const fromCents = (cents) => cents / 100;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Estado de partida de un escenario. */
function initialState(scenario) {
  return {
    moneyCents: toCents(scenario.initial_money),
    time: Number(scenario.initial_time_minutes),
    energy: Number(scenario.initial_energy),
    wellbeing: Number(scenario.initial_wellbeing),
  };
}

/** Estado en el formato que ve el navegador (dinero en unidades, no centavos). */
function publicState(state) {
  return {
    money: fromCents(state.moneyCents),
    time: state.time,
    energy: state.energy,
    wellbeing: state.wellbeing,
  };
}

/** Un gasto solo se permite si alcanza el dinero. Los ingresos siempre se permiten. */
function canAfford(state, choice) {
  const cost = toCents(choice.money_cost);
  return cost <= 0 || cost <= state.moneyCents;
}

/**
 * Aplica una opción. Devuelve el nuevo estado y los cambios realmente aplicados
 * (después de limitar energía y bienestar al rango 0–100), que son los que se
 * muestran al usuario y los que suman en el recibo.
 */
function applyChoice(state, choice) {
  const moneyDelta = -toCents(choice.money_cost);
  const next = {
    moneyCents: state.moneyCents + moneyDelta,
    time: clamp(state.time + Number(choice.time_change_minutes), 0, TIME_MAX),
    energy: clamp(state.energy + Number(choice.energy_change), 0, ENERGY_MAX),
    wellbeing: clamp(state.wellbeing + Number(choice.wellbeing_change), 0, WELLBEING_MAX),
  };
  const applied = {
    moneyCents: moneyDelta,
    time: next.time - state.time,
    energy: next.energy - state.energy,
    wellbeing: next.wellbeing - state.wellbeing,
  };
  return { state: next, applied };
}

/**
 * Reproduce una lista de decisiones (ya ordenadas) desde el estado inicial.
 * Cada elemento de `decisions` debe traer los campos de la opción elegida
 * más `moment_title`.
 */
function replay(scenario, decisions) {
  let state = initialState(scenario);
  const steps = [];
  for (const decision of decisions) {
    const { state: next, applied } = applyChoice(state, decision);
    steps.push({ decision, applied });
    state = next;
  }
  return { state, steps };
}

/**
 * Arma el recibo invisible a partir de los pasos de la sesión.
 * Devuelve las columnas de session_results y los dos resúmenes JSON.
 */
function buildResult(scenario, steps, finalState) {
  const start = initialState(scenario);

  // --- Costos visibles: dinero gastado, por categoría y por concepto.
  const expenseItems = [];
  const incomeItems = [];
  const byCategory = new Map();
  let visibleCents = 0;
  let incomeCents = 0;

  for (const { decision } of steps) {
    const cost = toCents(decision.money_cost);
    if (cost > 0) {
      expenseItems.push({ category: decision.category, label: decision.receipt_label, amount: fromCents(cost) });
      byCategory.set(decision.category, (byCategory.get(decision.category) || 0) + cost);
      visibleCents += cost;
    } else if (cost < 0) {
      incomeItems.push({ label: decision.receipt_label, amount: fromCents(-cost) });
      incomeCents += -cost;
    }
  }

  const categories = [...byCategory.entries()].map(([category, cents]) => ({
    category,
    label: CATEGORY_LABELS[category] || 'Otros',
    total: fromCents(cents),
  }));

  // --- Costos invisibles: lo que se consumió o se recuperó, sin recortes.
  let timeSpent = 0;
  let timeRecovered = 0;
  let energySpent = 0;
  let energyRecovered = 0;
  let wellbeingLost = 0;
  let wellbeingGained = 0;
  const notes = [];

  for (const { decision, applied } of steps) {
    if (applied.time < 0) timeSpent += -applied.time; else timeRecovered += applied.time;
    if (applied.energy < 0) energySpent += -applied.energy; else energyRecovered += applied.energy;
    if (applied.wellbeing < 0) wellbeingLost += -applied.wellbeing; else wellbeingGained += applied.wellbeing;
    if (decision.invisible_note) {
      notes.push({ moment: decision.moment_title, note: decision.invisible_note });
    }
  }

  return {
    final_money: fromCents(finalState.moneyCents).toFixed(2),
    final_time_minutes: finalState.time,
    final_energy: finalState.energy,
    final_wellbeing: finalState.wellbeing,
    visible_total: fromCents(visibleCents).toFixed(2),
    income_total: fromCents(incomeCents).toFixed(2),
    time_spent_minutes: timeSpent,
    energy_spent: energySpent,
    wellbeing_lost: wellbeingLost,
    visible_summary: {
      total: fromCents(visibleCents),
      categories,
      items: expenseItems,
      income: { total: fromCents(incomeCents), items: incomeItems },
    },
    invisible_summary: {
      start: { money: fromCents(start.moneyCents), time: start.time, energy: start.energy, wellbeing: start.wellbeing },
      timeSpentMinutes: timeSpent,
      timeRecoveredMinutes: timeRecovered,
      energySpent,
      energyRecovered,
      wellbeingLost,
      wellbeingGained,
      notes,
    },
  };
}

module.exports = {
  CATEGORY_LABELS,
  toCents,
  fromCents,
  initialState,
  publicState,
  canAfford,
  applyChoice,
  replay,
  buildResult,
};
