'use strict';

// Validación estricta de todo lo que llega del navegador. Cada función lanza
// un AppError 400 con un mensaje claro si el dato no es válido.

const { AppError } = require('./errors');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_INT = 2147483647; // límite de INTEGER en PostgreSQL

function bad(message) {
  return new AppError(400, 'validation_error', message);
}

function parseUuid(value, name = 'id') {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw bad(`El campo "${name}" no es un identificador válido.`);
  }
  return value.toLowerCase();
}

function parseSlug(value, name = 'scenario') {
  if (typeof value !== 'string' || value.length > 80 || !SLUG_RE.test(value)) {
    throw bad(`El campo "${name}" no es un identificador de escenario válido.`);
  }
  return value;
}

function parsePositiveInt(value, name) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_INT) {
    throw bad(`El campo "${name}" debe ser un número entero positivo.`);
  }
  return value;
}

function ensureOnlyKeys(body, allowed) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw bad('El cuerpo de la petición debe ser un objeto JSON.');
  }
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      throw bad(`El campo "${key}" no está permitido.`);
    }
  }
}

function validateStartSession(body) {
  ensureOnlyKeys(body, ['scenario']);
  return { scenario: parseSlug(body.scenario) };
}

function validateDecision(body) {
  ensureOnlyKeys(body, ['momentId', 'choiceId']);
  return {
    momentId: parsePositiveInt(body.momentId, 'momentId'),
    choiceId: parsePositiveInt(body.choiceId, 'choiceId'),
  };
}

function validateEmpty(body) {
  ensureOnlyKeys(body, []);
  return {};
}

module.exports = { parseUuid, parseSlug, validateStartSession, validateDecision, validateEmpty };
