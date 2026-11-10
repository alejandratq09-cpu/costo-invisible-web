'use strict';

// Acceso a PostgreSQL. La conexión se crea de forma perezosa y SOLO desde el
// backend, usando la variable de entorno DATABASE_URL. Todas las consultas del
// proyecto usan parámetros ($1, $2…), nunca concatenación de texto.

let pg = null;
try {
  pg = require('pg');
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') throw err;
}

let pool = null;

function configError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !connectionString.trim()) {
    throw configError('DB_NOT_CONFIGURED', 'DATABASE_URL no está definida');
  }
  if (!pg) {
    throw configError('PG_MODULE_MISSING', 'El módulo "pg" no está instalado');
  }

  const useSsl = String(process.env.DATABASE_SSL || '').toLowerCase() === 'true';
  const rejectUnauthorized = String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';

  pool = new pg.Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized } : undefined,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
  });

  // Sin este manejador, un cliente inactivo que pierda la conexión tumbaría el proceso.
  pool.on('error', (err) => {
    console.error('[pg] error en una conexión inactiva:', err.code || err.message);
  });

  return pool;
}

/** Ejecuta una consulta parametrizada. */
async function query(text, params = []) {
  return getPool().query(text, params);
}

/**
 * Ejecuta fn(client) dentro de una transacción. Hace COMMIT si termina bien y
 * ROLLBACK si lanza un error.
 */
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[pg] falló el ROLLBACK:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Comprueba de verdad la conexión y que las tablas existan. */
async function checkHealth() {
  const tables = await query(`SELECT to_regclass('public.scenarios') IS NOT NULL AS has_tables`);
  if (tables.rows[0].has_tables !== true) {
    const err = new Error('relation "scenarios" does not exist');
    err.code = '42P01';
    throw err;
  }
  const count = await query(`SELECT count(*)::int AS n FROM scenarios WHERE status = 'activo'`);
  return { activeScenarios: count.rows[0].n };
}

async function closePool() {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}

module.exports = { query, withTransaction, checkHealth, closePool, getPool };
