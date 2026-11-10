'use strict';

// Crea las tablas y carga los datos iniciales en la base indicada por DATABASE_URL.
//
//   npm run db:init     -> crea tablas (si faltan) y carga los escenarios. Es seguro repetirlo.
//   npm run db:reset    -> BORRA todas las tablas del proyecto (también las sesiones guardadas)
//                          y las vuelve a crear. Pide confirmación.
//
// Alternativa sin Node: psql "$DATABASE_URL" -f db/schema.sql -f db/seed.sql

require('../server/env');

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const db = require('../server/db');
const { toApiError } = require('../server/errors');

const DB_DIR = path.join(__dirname, '..', 'db');
const reset = process.argv.includes('--reset');
const assumeYes = process.argv.includes('--yes');

async function confirmReset() {
  if (assumeYes) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    'Esto BORRARÁ todas las tablas del proyecto y los datos guardados en ellas.\nEscribe BORRAR para continuar: ',
  );
  rl.close();
  return answer.trim() === 'BORRAR';
}

async function main() {
  if (reset && !(await confirmReset())) {
    console.log('Cancelado. No se cambió nada.');
    return;
  }

  const pool = db.getPool(); // falla con un mensaje claro si falta DATABASE_URL o el módulo pg
  const client = await pool.connect();
  try {
    if (reset) {
      await client.query('DROP TABLE IF EXISTS session_results, decisions, sessions, choices, moments, scenarios CASCADE');
      console.log('Tablas anteriores eliminadas.');
    }
    await client.query(fs.readFileSync(path.join(DB_DIR, 'schema.sql'), 'utf8'));
    console.log('✔ Esquema aplicado (db/schema.sql).');
    await client.query(fs.readFileSync(path.join(DB_DIR, 'seed.sql'), 'utf8'));
    console.log('✔ Datos iniciales aplicados (db/seed.sql).');

    const { rows } = await client.query(
      `SELECT (SELECT count(*) FROM scenarios)::int AS escenarios,
              (SELECT count(*) FROM moments)::int   AS momentos,
              (SELECT count(*) FROM choices)::int   AS opciones`,
    );
    console.log(`  Contenido: ${rows[0].escenarios} escenarios, ${rows[0].momentos} momentos, ${rows[0].opciones} opciones.`);
    console.log('Listo. Ahora ejecuta: npm start');
  } finally {
    client.release();
    await db.closePool();
  }
}

main().catch(async (err) => {
  const { message } = toApiError(err);
  console.error(`✖ No se pudo preparar la base de datos.\n  ${message}`);
  if (err && err.message && !/DATABASE_URL no está definida|módulo "pg"/.test(err.message)) {
    console.error(`  Detalle técnico: ${err.message}`);
  }
  await db.closePool().catch(() => {});
  process.exit(1);
});
