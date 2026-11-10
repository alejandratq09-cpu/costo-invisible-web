'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../server/engine');

const scenario = {
  initial_money: '10000.00',
  initial_time_minutes: 600,
  initial_energy: 50,
  initial_wellbeing: 50,
};

const choice = (over) => ({
  money_cost: '0.00', category: 'ninguna', time_change_minutes: 0, energy_change: 0, wellbeing_change: 0,
  receipt_label: null, invisible_note: null, moment_title: 'Momento', ...over,
});

test('el estado inicial sale del escenario (dinero llega como texto desde NUMERIC)', () => {
  const s = engine.initialState(scenario);
  assert.deepEqual(s, { moneyCents: 1000000, time: 600, energy: 50, wellbeing: 50 });
  assert.deepEqual(engine.publicState(s), { money: 10000, time: 600, energy: 50, wellbeing: 50 });
});

test('aplicar una opción cambia los cuatro indicadores', () => {
  const s = engine.initialState(scenario);
  const { state, applied } = engine.applyChoice(s, choice({
    money_cost: '7000.00', time_change_minutes: -40, energy_change: 12, wellbeing_change: -5,
  }));
  assert.deepEqual(state, { moneyCents: 300000, time: 560, energy: 62, wellbeing: 45 });
  assert.deepEqual(applied, { moneyCents: -700000, time: -40, energy: 12, wellbeing: -5 });
});

test('energía y bienestar se limitan a 0–100 y el cambio aplicado refleja el recorte', () => {
  const s = { moneyCents: 0, time: 100, energy: 95, wellbeing: 4 };
  const { state, applied } = engine.applyChoice(s, choice({ energy_change: 25, wellbeing_change: -10 }));
  assert.equal(state.energy, 100);
  assert.equal(state.wellbeing, 0);
  assert.equal(applied.energy, 5);
  assert.equal(applied.wellbeing, -4);
});

test('el tiempo nunca baja de 0', () => {
  const { state } = engine.applyChoice({ moneyCents: 0, time: 20, energy: 50, wellbeing: 50 }, choice({ time_change_minutes: -90 }));
  assert.equal(state.time, 0);
});

test('un gasto solo se permite si alcanza el dinero; un ingreso siempre', () => {
  const s = { moneyCents: 500000, time: 1, energy: 1, wellbeing: 1 };
  assert.equal(engine.canAfford(s, choice({ money_cost: '5000.00' })), true);
  assert.equal(engine.canAfford(s, choice({ money_cost: '5000.01' })), false);
  assert.equal(engine.canAfford({ ...s, moneyCents: 0 }, choice({ money_cost: '-45000.00' })), true);
});

test('un ingreso suma al dinero', () => {
  const { state, applied } = engine.applyChoice(engine.initialState(scenario), choice({ money_cost: '-24000.00' }));
  assert.equal(state.moneyCents, 3400000);
  assert.equal(applied.moneyCents, 2400000);
});

test('los centavos no acumulan error de punto flotante', () => {
  let s = { moneyCents: engine.toCents('0.30'), time: 1, energy: 1, wellbeing: 1 };
  s = engine.applyChoice(s, choice({ money_cost: '0.10' })).state;
  s = engine.applyChoice(s, choice({ money_cost: '0.20' })).state;
  assert.equal(s.moneyCents, 0);
  assert.equal(0.1 + 0.2 === 0.3, false); // por qué no se usa punto flotante
});

test('el recibo separa costos visibles e invisibles y cuadra con el estado final', () => {
  const decisions = [
    choice({ money_cost: '7000.00', category: 'alimentacion', receipt_label: 'Desayuno', time_change_minutes: -40, energy_change: 12, wellbeing_change: 6, invisible_note: 'Tiempo de cocina.', moment_title: 'Comida' }),
    choice({ money_cost: '7200.00', category: 'transporte', receipt_label: 'Bus', time_change_minutes: -170, energy_change: -10, wellbeing_change: -4, moment_title: 'Traslado' }),
    choice({ money_cost: '-24000.00', category: 'ingreso', receipt_label: 'Media jornada', time_change_minutes: -300, energy_change: -14, wellbeing_change: 2, invisible_note: 'Jornada corta.', moment_title: 'Trabajo' }),
  ];
  const { state, steps } = engine.replay(scenario, decisions);
  const r = engine.buildResult(scenario, steps, state);

  assert.equal(r.visible_total, '14200.00');
  assert.equal(r.income_total, '24000.00');
  assert.equal(r.final_money, '19800.00'); // 10000 - 14200 + 24000
  assert.equal(r.time_spent_minutes, 510);
  assert.equal(r.final_time_minutes, 600 - 510);
  assert.equal(r.energy_spent, 24);
  assert.equal(r.wellbeing_lost, 4);
  assert.deepEqual(r.visible_summary.categories.map((c) => c.category), ['alimentacion', 'transporte']);
  assert.equal(r.visible_summary.items.length, 2, 'los ingresos no aparecen como gastos');
  assert.equal(r.visible_summary.income.items[0].label, 'Media jornada');
  assert.deepEqual(r.invisible_summary.notes.map((n) => n.moment), ['Comida', 'Trabajo']);
  assert.equal(r.invisible_summary.energyRecovered, 12);
  assert.equal(r.invisible_summary.wellbeingGained, 8);
});

test('el recibo no incluye puntaje, ranking ni calificación', () => {
  const { state, steps } = engine.replay(scenario, [choice({})]);
  const json = JSON.stringify(engine.buildResult(scenario, steps, state)).toLowerCase();
  for (const word of ['score', 'puntaje', 'ganador', 'perdedor', 'rank', 'grade']) {
    assert.equal(json.includes(word), false, `no debería aparecer "${word}"`);
  }
});
