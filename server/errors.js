'use strict';

// Errores de la aplicación y traducción de errores de PostgreSQL a mensajes
// claros en español. Nunca se devuelven al navegador la cadena de conexión,
// la contraseña, los parámetros de la consulta ni el stack.

class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

const NETWORK_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE',
]);

/**
 * Convierte cualquier error en { status, code, message } seguro para el cliente.
 * Los errores inesperados se registran en el servidor (sin parámetros) y se
 * devuelven como un mensaje genérico.
 */
function toApiError(err) {
  if (err instanceof AppError) {
    return { status: err.status, code: err.code, message: err.message };
  }

  const code = err && err.code ? String(err.code) : '';
  const message = err && err.message ? String(err.message) : '';

  if (code === 'DB_NOT_CONFIGURED') {
    return {
      status: 503,
      code: 'db_not_configured',
      message: 'La aplicación no tiene configurada la base de datos. Define la variable DATABASE_URL en el archivo .env (hay un ejemplo en .env.example) y reinicia el servidor.',
    };
  }
  if (code === 'PG_MODULE_MISSING') {
    return {
      status: 503,
      code: 'pg_missing',
      message: 'Falta instalar las dependencias del servidor. Ejecuta "npm install" en la carpeta del proyecto y reinicia.',
    };
  }
  if (code === '28P01' || code === '28000') {
    return {
      status: 503,
      code: 'db_auth_failed',
      message: 'PostgreSQL rechazó el usuario o la contraseña de DATABASE_URL. Revisa las credenciales en el archivo .env.',
    };
  }
  if (code === '3D000') {
    return {
      status: 503,
      code: 'db_not_found',
      message: 'La base de datos indicada en DATABASE_URL no existe. Créala primero (por ejemplo: createdb costo_invisible) y vuelve a intentar.',
    };
  }
  if (code === '42P01') {
    return {
      status: 503,
      code: 'db_not_initialized',
      message: 'Las tablas todavía no existen en la base de datos. Ejecuta "npm run db:init" para crearlas y cargar los datos iniciales.',
    };
  }
  if (
    NETWORK_CODES.has(code) ||
    code.startsWith('08') || // errores de conexión
    code.startsWith('57P') || // servidor apagándose o reiniciando
    code === '53300' || // demasiadas conexiones
    /timeout|terminated|ECONNREFUSED|connect/i.test(message)
  ) {
    return {
      status: 503,
      code: 'db_unavailable',
      message: 'No se pudo conectar con la base de datos PostgreSQL. Comprueba que el servidor esté encendido y que el host, el puerto y DATABASE_URL sean correctos.',
    };
  }
  // Violaciones de integridad: no deberían ocurrir si la validación previa funciona,
  // pero si ocurren (por ejemplo, dos peticiones simultáneas) se explican bien.
  if (code === '23505') {
    return { status: 409, code: 'conflict', message: 'Esa decisión ya había quedado registrada.' };
  }
  if (code === '23503' || code === '23514') {
    return { status: 422, code: 'invalid_data', message: 'Los datos enviados no son coherentes con este escenario.' };
  }
  if (code === '40001' || code === '40P01') {
    return { status: 503, code: 'db_busy', message: 'La base de datos estaba ocupada. Intenta de nuevo en un momento.' };
  }

  // Inesperado: se registra solo lo necesario para depurar.
  console.error('[error inesperado]', code || '(sin código)', message);
  return { status: 500, code: 'internal_error', message: 'Ocurrió un error inesperado en el servidor. Intenta de nuevo.' };
}

module.exports = { AppError, toApiError };
