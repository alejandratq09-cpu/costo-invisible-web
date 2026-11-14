'use strict';

require('./env');

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const db = require('./db');
const routes = require('./routes');
const { AppError, toApiError } = require('./errors');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const TRUST_PROXY = String(process.env.TRUST_PROXY || '').toLowerCase() === 'true';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY_BYTES = 4 * 1024;

// ------------------------------------------------------------------ rutas

const ROUTES = [
  { method: 'GET', pattern: /^\/api\/health$/, handler: routes.health },
  { method: 'GET', pattern: /^\/api\/scenarios$/, handler: routes.listScenarios },
  { method: 'GET', pattern: /^\/api\/scenarios\/([^/]+)$/, keys: ['slug'], handler: routes.getScenario },
  { method: 'POST', pattern: /^\/api\/sessions$/, handler: routes.startSession, body: true, strict: true },
  { method: 'POST', pattern: /^\/api\/sessions\/([^/]+)\/decisions$/, keys: ['id'], handler: routes.recordDecision, body: true },
  { method: 'DELETE', pattern: /^\/api\/sessions\/([^/]+)\/last-decision$/, keys: ['id'], handler: routes.undoLastDecision },
  { method: 'POST', pattern: /^\/api\/sessions\/([^/]+)\/complete$/, keys: ['id'], handler: routes.completeSession, body: true },
  { method: 'GET', pattern: /^\/api\/stats$/, handler: routes.getStats },
];

// ------------------------------------------------------------------ utilidades HTTP

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; " +
    "base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function sendError(res, err) {
  console.error("🔥 ERROR REAL EN EL SERVIDOR:", err);
  const { status, code, message } = toApiError(err);
  sendJson(res, status, { error: { code, message } });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const chunks = [];
    let size = 0;
    let failed = false;

    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        failed = true;
        reject(new AppError(413, 'payload_too_large', 'La petición es demasiado grande.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', (err) => { if (!failed) { failed = true; reject(err); } });
    req.on('end', () => {
      if (failed) return;
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw === '') return resolve({});
      if (!/^application\/json\b/i.test(contentType)) {
        return reject(new AppError(415, 'unsupported_media_type', 'La petición debe enviarse como application/json.'));
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new AppError(400, 'invalid_json', 'El cuerpo de la petición no es un JSON válido.'));
      }
    });
  });
}

// Límite sencillo de peticiones por visitante, en memoria (se reinicia con el
// servidor). Frena abusos y evita llenar la base con sesiones basura.
const buckets = new Map();
function rateLimited(ip, key, limit, windowMs) {
  const now = Date.now();
  const id = `${key}:${ip}`;
  const entry = buckets.get(id);
  if (!entry || now - entry.start > windowMs) {
    buckets.set(id, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of buckets) if (now - entry.start > 120000) buckets.delete(id);
}, 60000).unref();

function clientIp(req) {
  if (TRUST_PROXY) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'desconocida';
}

// ------------------------------------------------------------------ API

async function handleApi(req, res, url) {
  const method = req.method;
  let matchedPath = false;

  for (const route of ROUTES) {
    const match = route.pattern.exec(url.pathname);
    if (!match) continue;
    matchedPath = true;
    if (route.method !== method) continue;

    const ip = clientIp(req);
    if (rateLimited(ip, 'api', 240, 60000) || (route.strict && rateLimited(ip, 'start', 30, 60000))) {
      res.setHeader('Retry-After', '60');
      return sendJson(res, 429, { error: { code: 'rate_limited', message: 'Demasiadas solicitudes seguidas. Espera un momento e intenta de nuevo.' } });
    }

    const params = {};
    (route.keys || []).forEach((key, i) => {
      try { params[key] = decodeURIComponent(match[i + 1]); } catch { params[key] = ''; }
    });
    const body = route.body ? await readJsonBody(req) : undefined;
    const result = await route.handler({ params, query: url.searchParams, body });
    return sendJson(res, result.status, result.body);
  }

  if (matchedPath) {
    throw new AppError(405, 'method_not_allowed', 'Método no permitido para esta ruta.');
  }
  throw new AppError(404, 'not_found', 'La ruta solicitada no existe.');
}

// ------------------------------------------------------------------ archivos estáticos

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'Método no permitido.' } });
  }

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { pathname = ''; }
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!pathname.startsWith('/') || pathname.includes('\0') || !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return sendJson(res, 404, { error: { code: 'not_found', message: 'No encontrado.' } });
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return sendJson(res, 404, { error: { code: 'not_found', message: 'No encontrado.' } });
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath)
      .on('error', () => res.destroy())
      .pipe(res);
  });
}

// ------------------------------------------------------------------ servidor

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return sendJson(res, 400, { error: { code: 'bad_request', message: 'Dirección no válida.' } });
  }

  res.on('finish', () => {
    if (url.pathname.startsWith('/api/')) {
      console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
    }
  });

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  } catch (err) {
    if (res.headersSent) return res.destroy();
    sendError(res, err);
  }
});

async function reportDatabaseStatus() {
  try {
    const info = await db.checkHealth();
    console.log(`✔ PostgreSQL conectado. Escenarios activos: ${info.activeScenarios}.`);
    if (info.activeScenarios === 0) {
      console.warn('! No hay escenarios activos. Ejecuta "npm run db:init" para cargar los datos iniciales.');
    }
  } catch (err) {
    const { code, message } = toApiError(err);
    console.error(`✖ No hay conexión útil con PostgreSQL (${code}).`);
    console.error(`  ${message}`);
    console.error('  El servidor sigue encendido: la web mostrará este aviso en lugar de simular datos.');
  }
}

server.listen(PORT, HOST, () => {
  console.log(`El costo invisible de llegar al final del día`);
  console.log(`Escuchando en http://${HOST}:${PORT}`);
  reportDatabaseStatus().then(async () => {
    const sweep = async () => {
      try { await routes.markAbandoned(); } catch { /* la base puede no estar disponible; se reintenta */ }
    };
    sweep();
    setInterval(sweep, 60 * 60 * 1000).unref();
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`✖ El puerto ${PORT} ya está en uso. Cambia PORT en .env o cierra el otro programa.`);
  } else {
    console.error('✖ No se pudo iniciar el servidor:', err.message);
  }
  process.exit(1);
});

function shutdown(signal) {
  console.log(`\n${signal} recibido: cerrando…`);
  server.close(async () => {
    await db.closePool().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));