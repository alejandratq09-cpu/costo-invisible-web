'use strict';

// Carga el archivo .env (si existe) sin sobrescribir variables ya definidas
// en el entorno real. Usa la función nativa de Node, sin dependencias extra.

const fs = require('node:fs');
const path = require('node:path');

const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}
