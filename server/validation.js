'use strict';

// Validación estricta de todo lo que llega del navegador. Cada función lanza
// un AppError 400 con un mensaje claro si el dato no es válido.

const { AppError } = require('./errors');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_INT = 2147483647; // límite de INTEGER en PostgreSQL

// Rango permitido para el presupuesto personalizado
const MIN_BUDGET = 5000;
const MAX_BUDGET = 500000;

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

/**
 * Valida los datos del registro y el presupuesto al iniciar una sesión.
 */
function validateStartSession(body) {
  ensureOnlyKeys(body, ['scenario', 'budget', 'userName', 'userAge', 'userCity']);
  const scenario = parseSlug(body.scenario);
  
  let budget = null;
  if (body.budget !== undefined && body.budget !== null) {
    if (typeof body.budget !== 'number' || !Number.isInteger(body.budget)) {
      throw bad('El presupuesto debe ser un número entero.');
    }
    if (body.budget < MIN_BUDGET || body.budget > MAX_BUDGET) {
      throw bad(`El presupuesto debe estar entre $${MIN_BUDGET.toLocaleString('es-CO')} y $${MAX_BUDGET.toLocaleString('es-CO')}.`);
    }
    budget = body.budget;
  }

  // Validar registro (opcional)
  let userName = null;
  if (body.userName !== undefined && body.userName !== null) {
    if (typeof body.userName !== 'string' || body.userName.trim().length === 0 || body.userName.length > 80) {
      throw bad('El nombre debe ser un texto de entre 1 y 80 caracteres.');
    }
    userName = body.userName.trim();
  }

  let userAge = null;
  if (body.userAge !== undefined && body.userAge !== null) {
    if (typeof body.userAge !== 'number' || !Number.isInteger(body.userAge) || body.userAge < 1 || body.userAge > 120) {
      throw bad('La edad debe ser un número entero entre 1 y 120.');
    }
    userAge = body.userAge;
  }

  let userCity = null;
  if (body.userCity !== undefined && body.userCity !== null) {
    if (typeof body.userCity !== 'string' || body.userCity.trim().length === 0 || body.userCity.length > 100) {
      throw bad('La ciudad debe ser un texto de entre 1 y 100 caracteres.');
    }
    userCity = body.userCity.trim();
  }

  return { scenario, budget, userName, userAge, userCity };
}

function validateDecision(body) {
  ensureOnlyKeys(body, ['momentId', 'choiceId']);
  return {
    momentId: parsePositiveInt(body.momentId, 'momentId'),
    choiceId: parsePositiveInt(body.choiceId, 'choiceId'),
  };
}

/**
 * Valida el body de una sesión completada.
 * Permite los campos `emotionalState` (emoción elegida) y `emotionalReflection` (reflexión).
 */
function validateCompleteSession(body) {
  ensureOnlyKeys(body, ['emotionalState', 'emotionalReflection']);
  
  let emotionalState = null;
  if (body.emotionalState !== undefined && body.emotionalState !== null) {
    if (typeof body.emotionalState !== 'string' || body.emotionalState.length > 50) {
      throw bad('La emoción debe ser un texto de máximo 50 caracteres.');
    }
    emotionalState = body.emotionalState.trim();
  }

  let emotionalReflection = null;
  if (body.emotionalReflection !== undefined && body.emotionalReflection !== null) {
    if (typeof body.emotionalReflection !== 'string' || body.emotionalReflection.length > 500) {
      throw bad('La reflexión debe ser un texto de máximo 500 caracteres.');
    }
    emotionalReflection = body.emotionalReflection.trim();
  }
  
  return { emotionalState, emotionalReflection };
}

// Mantengo validateEmpty por compatibilidad con el código existente
function validateEmpty(body) {
  return validateCompleteSession(body);
}

module.exports = { 
  parseUuid, 
  parseSlug, 
  validateStartSession, 
  validateDecision, 
  validateCompleteSession,
  validateEmpty 
};