'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../server/validation');
const { AppError, toApiError } = require('../server/errors');

const rejects = (fn) => assert.throws(fn, (e) => e instanceof AppError && e.status === 400);

test('parseUuid acepta UUID válidos y rechaza el resto', () => {
  assert.equal(v.parseUuid('11111111-1111-4111-8111-111111111111'), '11111111-1111-4111-8111-111111111111');
  for (const bad of ['', 'abc', "1' OR '1'='1", 123, null, undefined, '11111111-1111-4111-8111-11111111111g']) {
    rejects(() => v.parseUuid(bad));
  }
});

test('parseSlug solo admite minúsculas, números y guiones', () => {
  assert.equal(v.parseSlug('dia-con-horario-fijo'), 'dia-con-horario-fijo');
  for (const bad of ['', 'Dia', 'a_b', 'a--b', '-a', "x'; DROP TABLE scenarios;--", 'a'.repeat(81), 5]) {
    rejects(() => v.parseSlug(bad));
  }
});

test('la decisión exige enteros positivos y rechaza campos extra', () => {
  assert.deepEqual(v.validateDecision({ momentId: 101, choiceId: 1011 }), { momentId: 101, choiceId: 1011 });
  for (const bad of [
    { momentId: '101', choiceId: 1011 }, { momentId: 1.5, choiceId: 1 }, { momentId: 0, choiceId: 1 },
    { momentId: -1, choiceId: 1 }, { momentId: 101 }, { momentId: 101, choiceId: 1011, extra: true },
    { momentId: 2 ** 31, choiceId: 1 }, null, [], 'x',
  ]) {
    rejects(() => v.validateDecision(bad));
  }
});

test('iniciar sesión solo acepta { scenario }', () => {
  assert.deepEqual(v.validateStartSession({ scenario: 'dia-sin-empleo-fijo' }), { scenario: 'dia-sin-empleo-fijo' });
  rejects(() => v.validateStartSession({ scenario: 'a', name: 'María' }));
  rejects(() => v.validateStartSession({}));
});

test('los errores de PostgreSQL se traducen a mensajes claros sin filtrar secretos', () => {
  const cases = [
    [{ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:5432' }, 'db_unavailable'],
    [{ code: '28P01', message: 'password authentication failed for user "x"' }, 'db_auth_failed'],
    [{ code: '3D000', message: 'database "x" does not exist' }, 'db_not_found'],
    [{ code: '42P01', message: 'relation "scenarios" does not exist' }, 'db_not_initialized'],
    [{ code: 'DB_NOT_CONFIGURED', message: 'x' }, 'db_not_configured'],
    [{ code: 'PG_MODULE_MISSING', message: 'x' }, 'pg_missing'],
    [{ code: '23505', message: 'dup' }, 'conflict'],
  ];
  for (const [err, code] of cases) {
    const out = toApiError(Object.assign(new Error(err.message), err));
    assert.equal(out.code, code);
    assert.equal(out.message.includes('127.0.0.1'), false);
    assert.equal(out.message.includes('password authentication'), false);
  }
  const unknown = toApiError(Object.assign(new Error('postgres://u:secreto@host/db falló'), { code: 'XX000' }));
  assert.equal(unknown.status, 500);
  assert.equal(unknown.message.includes('secreto'), false);
});
