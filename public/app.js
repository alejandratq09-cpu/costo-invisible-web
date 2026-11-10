'use strict';

/* El costo invisible de llegar al final del día — interfaz.
   El navegador nunca habla con PostgreSQL: solo con la API del backend (/api/...).
   Todo el contenido se inserta con textContent, nunca con innerHTML. */

(() => {
  // ------------------------------------------------------------ utilidades

  const $ = (selector) => document.querySelector(selector);

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === false || value === null || value === undefined) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  const MINUS = '−';

  function formatMoney(amount, currency) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: currency || 'COP', maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatDuration(minutes) {
    const total = Math.max(0, Math.round(minutes));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h && m) return `${h} h ${m} min`;
    if (h) return `${h} h`;
    return `${m} min`;
  }

  function sign(n) { return n > 0 ? '+' : n < 0 ? MINUS : ''; }

  function announce(message) {
    const live = $('#live');
    live.textContent = '';
    window.setTimeout(() => { live.textContent = message; }, 60);
  }

  // ------------------------------------------------------------ API

  class ApiError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function api(method, url, body) {
    let response;
    try {
      response = await fetch(url, {
        method,
        cache: 'no-store',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'network',
        'No pudimos comunicarnos con el servidor de la aplicación. Comprueba que esté en marcha (npm start) y que tu conexión funcione.');
    }
    let data = null;
    try { data = await response.json(); } catch { /* respuesta sin JSON */ }
    if (!response.ok) {
      const info = data && data.error;
      throw new ApiError(response.status, (info && info.code) || 'error',
        (info && info.message) || 'Ocurrió un error inesperado. Intenta de nuevo.');
    }
    return data;
  }

  // ------------------------------------------------------------ estado

  const METERS = [
    { key: 'money', label: 'Dinero disponible' },
    { key: 'time', label: 'Tiempo restante' },
    { key: 'energy', label: 'Energía' },
    { key: 'wellbeing', label: 'Bienestar' },
  ];

  const app = {
    scenarios: [],
    played: new Set(),
    preselect: null,
    scenario: null,
    moments: [],
    sessionId: null,
    index: 0,
    start: null,
    state: null,
    busy: false,
    retry: null,
  };

  // ------------------------------------------------------------ pantallas

  const SCREENS = ['intro', 'moment', 'receipt', 'error', 'history'];
  const HEADINGS = { intro: '#intro-title', moment: '#moment-title', receipt: '#receipt-title', error: '#error-title', history: '#history-title' };

  function showScreen(name) {
    $('#loading').hidden = true;
    for (const id of SCREENS) $(`#screen-${id}`).hidden = id !== name;
    window.scrollTo(0, 0);
    const heading = $(HEADINGS[name]);
    if (heading) heading.focus({ preventScroll: true });
  }

  const DB_CODES = new Set([
    'db_not_configured', 'pg_missing', 'db_unavailable', 'db_auth_failed',
    'db_not_found', 'db_not_initialized', 'db_busy', 'network', 'no_scenarios',
  ]);
  const SESSION_CODES = new Set(['session_not_found', 'session_closed', 'all_answered', 'wrong_moment']);

  function showError(err, retry) {
    const code = err.code || 'error';
    const isSession = SESSION_CODES.has(code);
    let title = 'Algo falló';
    if (code === 'network') title = 'No pudimos hablar con el servidor';
    else if (DB_CODES.has(code)) title = 'No pudimos conectar con la base de datos';
    else if (isSession) title = 'Esta experiencia ya no está disponible';

    $('#error-title').textContent = title;
    $('#error-message').textContent = err.message || 'Ocurrió un error inesperado.';
    $('#error-help').hidden = !(DB_CODES.has(code) && code !== 'network');
    $('#retry-button').hidden = isSession;
    $('#restart-button').hidden = !isSession;
    app.retry = retry || null;
    app.busy = false;
    showScreen('error');
  }

  // ------------------------------------------------------------ medidores

  function buildMeters(container, idPrefix) {
    container.replaceChildren();
    const refs = {};
    for (const meter of METERS) {
      const labelId = `${idPrefix}-${meter.key}-label`;
      const value = el('span', { class: 'meter__value' });
      const track = el('div', { class: 'meter__track', role: 'meter', 'aria-labelledby': labelId, 'aria-valuemin': 0 });
      const fill = el('div', { class: 'meter__fill' });
      track.append(fill);
      container.append(
        el('div', { class: `meter meter--${meter.key}` },
          el('div', { class: 'meter__head' }, el('span', { class: 'meter__label', id: labelId, text: meter.label }), value),
          track),
      );
      refs[meter.key] = { value, track, fill };
    }
    return refs;
  }

  function updateMeters(refs, state, start, currency) {
    const set = (key, pct, max, now, text, valueText) => {
      const r = refs[key];
      r.value.textContent = text;
      r.track.setAttribute('aria-valuemax', String(max));
      r.track.setAttribute('aria-valuenow', String(now));
      r.track.setAttribute('aria-valuetext', valueText);
      r.fill.style.setProperty('--pct', String(Math.max(0, Math.min(100, pct))));
    };
    const moneyPct = start.money > 0 ? (state.money / start.money) * 100 : (state.money > 0 ? 100 : 0);
    set('money', moneyPct, Math.max(start.money, state.money), state.money,
      formatMoney(state.money, currency),
      `${formatMoney(state.money, currency)}; al empezar tenías ${formatMoney(start.money, currency)}`);
    set('time', (state.time / start.time) * 100, start.time, state.time,
      formatDuration(state.time),
      `${formatDuration(state.time)} de ${formatDuration(start.time)}`);
    set('energy', state.energy, 100, state.energy, `${state.energy} / 100`, `${state.energy} de 100`);
    set('wellbeing', state.wellbeing, 100, state.wellbeing, `${state.wellbeing} / 100`, `${state.wellbeing} de 100`);
  }

  let liveMeters = null;
  let finalMeters = null;

  function stateSummary(state, currency) {
    return `Dinero disponible: ${formatMoney(state.money, currency)}. Tiempo restante: ${formatDuration(state.time)}. ` +
      `Energía: ${state.energy} de 100. Bienestar: ${state.wellbeing} de 100.`;
  }

  // ------------------------------------------------------------ historial (localStorage)

  const HISTORY_KEY = 'costo-invisible-history';

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (err) {
      console.error('No se pudo guardar el historial:', err);
    }
  }

  function addToHistory(result) {
    const history = loadHistory();
    history.unshift({
      date: new Date().toISOString(),
      scenario: result.scenario.title,
      finalMoney: result.final.money,
      finalTime: result.final.time,
      finalEnergy: result.final.energy,
      finalWellbeing: result.final.wellbeing,
      reflection: result.scenario.reflection,
    });
    // Guardar solo los últimos 10
    if (history.length > 10) history.length = 10;
    saveHistory(history);
  }

  function renderHistory() {
    const list = $('#history-list');
    list.replaceChildren();
    const history = loadHistory();

    if (history.length === 0) {
      list.append(el('p', { class: 'stats__note', text: 'Todavía no has guardado ningún recorrido. ¡Juega uno y vuelve aquí!' }));
      return;
    }

    for (const item of history) {
      const date = new Date(item.date).toLocaleDateString('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const card = el('div', { class: 'history-card' },
        el('div', { class: 'history-card__header' },
          el('span', { class: 'history-card__date', text: date }),
          el('span', { class: 'history-card__scenario', text: item.scenario })
        ),
        el('div', { class: 'history-card__stats' },
          el('span', {}, `💰 ${formatMoney(item.finalMoney, 'COP')}`),
          el('span', {}, `⏱ ${formatDuration(item.finalTime)}`),
          el('span', {}, `⚡ ${item.finalEnergy}/100`),
          el('span', {}, `💜 ${item.finalWellbeing}/100`)
        ),
        el('p', { class: 'history-card__reflection', text: item.reflection })
      );
      list.append(card);
    }
  }

  // ------------------------------------------------------------ inicio

  function renderIntro() {
    const list = $('#scenario-list');
    list.replaceChildren();

    const fallback = app.scenarios.find((s) => !app.played.has(s.slug)) || app.scenarios[0];
    const selected = app.scenarios.find((s) => s.slug === app.preselect) || fallback;

    for (const scenario of app.scenarios) {
      const base = `sc-${scenario.slug}`;
      const radio = el('input', {
        type: 'radio', name: 'scenario', id: base, value: scenario.slug,
        'aria-labelledby': `${base}-title`, 'aria-describedby': `${base}-desc ${base}-start`,
        checked: scenario.slug === selected.slug,
      });
      const start = scenario.start;
      list.append(
        el('label', { class: 'scenario', for: base },
          radio,
          el('span', { class: 'scenario__title', id: `${base}-title` },
            scenario.title,
            app.played.has(scenario.slug) ? el('span', { class: 'scenario__played', text: 'Ya recorrido' }) : null),
          el('span', { class: 'scenario__desc', id: `${base}-desc`, text: scenario.profile }),
          el('span', { class: 'scenario__start', id: `${base}-start` },
            `Empiezas con ${formatMoney(start.money, scenario.currency)}, ${formatDuration(start.time)} de día, ` +
            `energía ${start.energy} y bienestar ${start.wellbeing}.`)),
      );
    }

    const button = $('#start-button');
    button.disabled = false;
    button.textContent = 'Comenzar el día';
    showScreen('intro');
  }
  
  async function loadIntroStats() {
    try {
      const stats = await api('GET', '/api/stats?scenario=dia-con-horario-fijo');
      const note = $('#intro-stats');
      if (stats.totalCompleted > 0) {
        note.textContent = stats.totalCompleted === 1
          ? 'Una persona ya recorrió estos días de forma anónima.'
          : `${stats.totalCompleted} recorridos completados de forma anónima hasta ahora.`;
        note.hidden = false;
      }
    } catch (err) { 
      console.error('Error cargando stats:', err); 
    }
  }

  async function startExperience(slug) {
    const button = $('#start-button');
    button.disabled = true;
    button.textContent = 'Preparando tu día…';
    try {
      const budgetInput = $('#budget-input');
      let customBudget = null;
      if (budgetInput) {
        customBudget = parseInt(budgetInput.value, 10);
        if (isNaN(customBudget) || customBudget < 5000 || customBudget > 500000) {
          throw new ApiError(0, 'invalid_budget', 'El presupuesto debe estar entre $5.000 y $500.000.');
        }
      }

      const [full, session] = await Promise.all([
        api('GET', `/api/scenarios/${encodeURIComponent(slug)}`),
        api('POST', '/api/sessions', { scenario: slug, budget: customBudget }),
      ]);
      if (full.moments.length !== session.totalMoments) {
        throw new ApiError(0, 'inconsistent', 'Los datos del escenario cambiaron mientras empezabas. Vuelve a intentarlo.');
      }
      app.scenario = full.scenario;
      app.moments = full.moments;
      app.sessionId = session.sessionId;
      app.start = session.state;
      app.state = session.state;
      app.index = 0;

      liveMeters = buildMeters($('#meters-live'), 'live');
      renderMoment();
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Comenzar el día';
      showError(err, () => renderIntro());
    }
  }

  // ------------------------------------------------------------ momentos

  function renderMoment() {
    const moment = app.moments[app.index];
    const total = app.moments.length;
    const currency = app.scenario.currency;

    $('#progress-text').textContent = `Momento ${app.index + 1} de ${total}`;
    $('#progress-fill').style.width = `${((app.index + 1) / total) * 100}%`;
    $('#moment-kicker').textContent = app.scenario.title;
    $('#moment-title').textContent = moment.title;
    $('#moment-narrative').textContent = moment.narrative;
    $('#moment-situation').textContent = moment.situation;
    $('#consequence').hidden = true;
    $('#moment-error').hidden = true;
    updateMeters(liveMeters, app.state, app.start, currency);

    const list = $('#choices');
    list.classList.remove('is-locked');
    list.replaceChildren();

    let affordable = 0;
    moment.choices.forEach((choice) => {
      const canPay = choice.cost <= app.state.money;
      if (canPay) affordable += 1;
      const metaId = `choice-${choice.id}-meta`;
      let metaText = '';
      if (choice.cost > 0) {
        metaText = `Cuesta ${formatMoney(choice.cost, currency)}`;
        if (!canPay) metaText += '. No alcanza con el dinero que te queda';
      }
      const button = el('button', {
        type: 'button', class: 'choice', 'data-choice': choice.id,
        disabled: !canPay,
        'aria-disabled': canPay ? false : 'true',
        'aria-describedby': metaText ? metaId : false,
      },
      el('span', { class: 'choice__text', text: choice.text }),
      metaText ? el('span', { class: 'choice__meta', id: metaId, text: metaText }) : null);
      button.addEventListener('click', () => onChoose(choice, button, canPay));
      list.append(el('li', {}, button));
    });

    if (affordable === 0) {
      const err = $('#moment-error');
      err.textContent = 'Ninguna opción es posible con el dinero que queda. Esto no debería pasar: vuelve a empezar para recorrer el día de nuevo.';
      err.hidden = false;
    }

    showScreen('moment');
  }

  async function onChoose(choice, button, canPay) {
    if (app.busy || $('#choices').classList.contains('is-locked')) return;
    if (!canPay) {
      announce('No alcanza el dinero para esta opción. Elige otra.');
      return;
    }
    app.busy = true;
    $('#moment-error').hidden = true;
    const moment = app.moments[app.index];

    let result;
    try {
      result = await api('POST', `/api/sessions/${encodeURIComponent(app.sessionId)}/decisions`, {
        momentId: moment.id,
        choiceId: choice.id,
      });
    } catch (err) {
      app.busy = false;
      if (DB_CODES.has(err.code) || SESSION_CODES.has(err.code)) {
        showError(err, () => renderMoment());
      } else {
        const box = $('#moment-error');
        box.textContent = err.message;
        box.hidden = false;
      }
      return;
    }

    app.busy = false;
    app.state = result.state;
    const currency = app.scenario.currency;

    const list = $('#choices');
    list.classList.add('is-locked');
    for (const b of list.querySelectorAll('.choice')) {
      b.setAttribute('aria-disabled', 'true');
      b.removeAttribute('aria-describedby');
      const meta = b.querySelector('.choice__meta');
      if (meta) meta.remove();
    }
    button.classList.add('is-chosen');
    button.setAttribute('aria-current', 'true');
    button.append(el('span', { class: 'choice__meta', text: 'Esta fue tu elección' }));

    updateMeters(liveMeters, result.state, app.start, currency);
    renderConsequence(result, currency);
  }

  function renderConsequence(result, currency) {
    $('#consequence-text').textContent = result.consequence;

    const effects = $('#consequence-effects');
    effects.replaceChildren();
    const items = [
      { label: 'Dinero', value: result.effects.money, text: (n) => formatMoney(Math.abs(n), currency) },
      { label: 'Tiempo', value: result.effects.time, text: (n) => formatDuration(Math.abs(n)) },
      { label: 'Energía', value: result.effects.energy, text: (n) => String(Math.abs(n)) },
      { label: 'Bienestar', value: result.effects.wellbeing, text: (n) => String(Math.abs(n)) },
    ];
    let any = false;
    for (const item of items) {
      if (item.value === 0) continue;
      any = true;
      const up = item.value > 0;
      effects.append(el('li', {},
        el('span', { class: 'effects__label', text: item.label }),
        el('span', { class: 'effects__arrow', 'aria-hidden': 'true', text: up ? '▲' : '▼' }),
        el('span', { text: `${sign(item.value)}${item.text(item.value)}` }),
        el('span', { class: 'sr-only', text: up ? ' (aumenta)' : ' (disminuye)' })));
    }
    if (!any) effects.append(el('li', { text: 'Sin cambios en tus indicadores' }));

    const next = $('#next-button');
    next.textContent = result.isLast ? 'Ver mi recibo invisible' : 'Siguiente momento';
    next.disabled = false;
    $('#consequence').hidden = false;

    const undoBtn = $('#undo-button');
    if (undoBtn) undoBtn.remove();
    
    const undoContainer = el('div', { style: 'margin-top: 1rem; text-align: center;' },
      el('button', {
        id: 'undo-button',
        class: 'button button--secondary',
        type: 'button',
        style: 'font-size: 0.9rem; padding: 0.5rem 1rem;'
      }, '↩ Volver a decidir'),
    );
    $('#consequence').append(undoContainer);
    
    $('#undo-button').addEventListener('click', async () => {
      if (app.busy) return;
      app.busy = true;
      try {
        const res = await api('DELETE', `/api/sessions/${encodeURIComponent(app.sessionId)}/last-decision`);
        app.state = res.state;
        app.busy = false;
        renderMoment();
      } catch (err) {
        app.busy = false;
        alert('No se pudo deshacer: ' + err.message);
      }
    });

    announce(`${result.consequence} ${stateSummary(result.state, currency)}`);
    $('#consequence-title').focus({ preventScroll: true });
    $('#consequence').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  async function onNext() {
    if (app.busy) return;
    if (app.index + 1 < app.moments.length) {
      app.index += 1;
      renderMoment();
      return;
    }
    const button = $('#next-button');
    button.disabled = true;
    button.textContent = 'Preparando tu recibo…';
    app.busy = true;
    try {
      const result = await api('POST', `/api/sessions/${encodeURIComponent(app.sessionId)}/complete`, {});
      app.busy = false;
      renderReceipt(result);
    } catch (err) {
      app.busy = false;
      button.disabled = false;
      button.textContent = 'Ver mi recibo invisible';
      showError(err, onNext);
    }
  }

  // ------------------------------------------------------------ recibo

  function renderReceipt(result) {
    const currency = result.scenario.currency;
    app.played.add(result.scenario.slug);
    addToHistory(result); // Guardar en el historial

    $('#receipt-scenario').textContent = result.scenario.title;

    const visible = $('#visible-items');
    visible.replaceChildren();
    if (result.visible.items.length === 0) {
      visible.append(el('li', {}, el('span', { text: 'No hubo gastos en dinero en este día.' }), el('span', { text: formatMoney(0, currency) })));
    }
    for (const item of result.visible.items) {
      const categoryLabel = (result.visible.categories.find((c) => c.category === item.category) || {}).label;
      visible.append(el('li', {},
        el('span', {}, item.label, categoryLabel ? el('span', { class: 'line__sub', text: categoryLabel }) : null),
        el('span', { text: formatMoney(item.amount, currency) })));
    }
    $('#visible-total').textContent = formatMoney(result.visible.total, currency);

    const income = result.visible.income;
    $('#income-block').hidden = income.items.length === 0;
    const incomeList = $('#income-items');
    incomeList.replaceChildren();
    for (const item of income.items) {
      incomeList.append(el('li', {}, el('span', { text: item.label }), el('span', { text: `+${formatMoney(item.amount, currency)}` })));
    }
    $('#income-total').textContent = formatMoney(income.total, currency);

    const inv = result.invisible;
    const invisible = $('#invisible-items');
    invisible.replaceChildren();
    const line = (label, value, sub) => el('li', {},
      el('span', {}, label, sub ? el('span', { class: 'line__sub', text: sub }) : null),
      el('span', { text: value }));
    invisible.append(
      line('Tiempo dedicado', formatDuration(inv.timeSpentMinutes),
        `Te quedaron ${formatDuration(result.final.time)} de ${formatDuration(inv.start.time)}`),
      line('Energía gastada', `${inv.energySpent} pts`,
        inv.energyRecovered > 0
          ? `Recuperaste ${inv.energyRecovered} pts. Terminaste en ${result.final.energy} de 100`
          : `Terminaste en ${result.final.energy} de 100`),
      line('Bienestar sacrificado', `${inv.wellbeingLost} pts`,
        inv.wellbeingGained > 0
          ? `Ganaste ${inv.wellbeingGained} pts. Terminaste en ${result.final.wellbeing} de 100`
          : `Terminaste en ${result.final.wellbeing} de 100`));

    $('#notes-block').hidden = inv.notes.length === 0;
    const notes = $('#notes-list');
    notes.replaceChildren();
    for (const n of inv.notes) {
      notes.append(el('li', {}, el('span', { class: 'notes__moment', text: n.moment }), n.note));
    }

    finalMeters = buildMeters($('#meters-final'), 'final');
    updateMeters(finalMeters, result.final, result.start, currency);

    $('#reflection-text').textContent = result.scenario.reflection;

    $('#stats-block').open = false;
    $('#stats-content').replaceChildren(el('p', { class: 'stats__note', text: 'Cargando estadísticas…' }));

    const receiptSection = $('#screen-receipt');
    const existingBtn = $('#play-again-button');
    if (!existingBtn) {
      const playAgainContainer = el('div', { style: 'text-align: center; margin-top: 2rem; padding-bottom: 2rem;' },
        el('button', { 
          id: 'play-again-button', 
          class: 'button button--primary', 
          type: 'button',
          style: 'font-size: 1.1rem; padding: 0.8rem 2rem; cursor: pointer;'
        }, 'Jugar de nuevo')
      );
      receiptSection.append(playAgainContainer);
      
      $('#play-again-button').addEventListener('click', () => {
        window.location.reload();
      });
    }

    showScreen('receipt');
    announce('Tu recibo invisible está listo.');
    loadStats(result.scenario.slug, currency);
  }

  async function loadStats(slug, currency) {
    const box = $('#stats-content');
    try {
      const stats = await api('GET', `/api/stats?scenario=${encodeURIComponent(slug)}`);
      const s = stats.scenarios[0];
      box.replaceChildren();
      if (!s || !s.hasEnoughData) {
        box.append(el('p', { class: 'stats__note',
          text: `Todavía hay pocas experiencias completadas de este día para mostrar estadísticas anónimas (se necesitan al menos ${stats.minGroupSize}).` }));
        return;
      }
      box.append(el('p', { class: 'stats__note',
        text: `Basado en ${s.completed} recorridos completados, todos anónimos. No hay decisiones correctas: así se repartieron.` }));
      if (s.averages) {
        box.append(el('p', { class: 'stats__note',
          text: `En promedio, en este día se gastaron ${formatMoney(s.averages.visibleTotal, currency)} y se dedicaron ` +
            `${formatDuration(s.averages.timeSpentMinutes)} a cubrir necesidades.` }));
      }
      for (const moment of s.moments || []) {
        box.append(el('p', { class: 'stats__moment', text: moment.title }));
        const list = el('ul', { class: 'stats__list' });
        for (const option of moment.options) {
          const bar = el('span');
          bar.style.setProperty('--pct', String(option.percent));
          list.append(el('li', { class: 'stats__row' },
            el('div', { class: 'stats__row-head' }, el('span', { text: option.text }), el('span', { text: `${option.percent} %` })),
            el('div', { class: 'stats__bar', 'aria-hidden': 'true' }, bar)));
        }
        box.append(list);
      }
    } catch {
      box.replaceChildren(el('p', { class: 'stats__note', text: 'No pudimos cargar las estadísticas en este momento.' }));
    }
  }

  // ------------------------------------------------------------ eventos

  $('#start-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const checked = document.querySelector('input[name="scenario"]:checked');
    if (checked) startExperience(checked.value);
  });

  $('#next-button').addEventListener('click', onNext);

  $('#other-button').addEventListener('click', () => {
    const current = app.scenario ? app.scenario.slug : null;
    const candidates = app.scenarios.filter((s) => s.slug !== current);
    const unplayed = candidates.find((s) => !app.played.has(s.slug));
    app.preselect = (unplayed || candidates[0] || app.scenarios[0]).slug;
    renderIntro();
  });

  $('#repeat-button').addEventListener('click', () => {
    if (app.scenario) startExperience(app.scenario.slug);
  });

  $('#retry-button').addEventListener('click', () => {
    const retry = app.retry || init;
    retry();
  });

  $('#restart-button').addEventListener('click', () => {
    app.preselect = app.scenario ? app.scenario.slug : null;
    renderIntro();
  });

  // Historial
  $('#view-history-button').addEventListener('click', () => {
    renderHistory();
    showScreen('history');
  });

  $('#close-history-button').addEventListener('click', () => {
    renderIntro();
  });

  $('#clear-history-button').addEventListener('click', () => {
    if (confirm('¿Seguro que quieres borrar tu historial? Esta acción no se puede deshacer.')) {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
    }
  });

  const budgetInput = $('#budget-input');
  const budgetSlider = $('#budget-slider');
  if (budgetInput && budgetSlider) {
    budgetInput.addEventListener('input', () => {
      budgetSlider.value = budgetInput.value;
    });
    budgetSlider.addEventListener('input', () => {
      budgetInput.value = budgetSlider.value;
    });
  }

  const downloadBtn = $('#download-pdf-button');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      const receiptElement = $('#receipt');
      const originalText = downloadBtn.textContent;
      downloadBtn.textContent = 'Generando PDF...';
      downloadBtn.disabled = true;

      try {
        const canvas = await html2canvas(receiptElement, {
          scale: 2,
          backgroundColor: getComputedStyle(document.body).backgroundColor,
          useCORS: true
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 190;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png');
        
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
        
        const scenarioTitle = $('#receipt-scenario').textContent || 'recibo';
        pdf.save(`recibo-invisible-${scenarioTitle.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      } catch (error) {
        console.error('Error al generar el PDF:', error);
        alert('Lo sentimos, no se pudo generar el PDF. Intenta de nuevo.');
      } finally {
        downloadBtn.textContent = originalText;
        downloadBtn.disabled = false;
      }
    });
  }

  // ------------------------------------------------------------ arranque

  async function init() {
    $('#loading').hidden = false;
    for (const id of SCREENS) $(`#screen-${id}`).hidden = true;
    try {
      const data = await api('GET', '/api/scenarios');
      if (!data.scenarios || data.scenarios.length === 0) {
        throw new ApiError(0, 'no_scenarios',
          'La base de datos está conectada, pero no tiene escenarios activos. Ejecuta "npm run db:init" para cargar los datos iniciales.');
      }
      app.scenarios = data.scenarios;
      renderIntro();
      loadIntroStats();
    } catch (err) {
      showError(err, init);
    }
  }

  init();
})();