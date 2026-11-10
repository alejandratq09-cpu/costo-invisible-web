# El costo invisible de llegar al final del día

Experiencia web interactiva, completamente en español, que recorre seis momentos de un día (despertar, comer, trasladarse, trabajar o estudiar, atender la salud o un imprevisto, descansar o resolver pendientes). Cada decisión cambia el **dinero, el tiempo, la energía y el bienestar**, y al final se entrega un **recibo invisible** con costos visibles e invisibles. No hay puntaje, ganadores ni perdedores.

- **Frontend**: HTML, CSS y JavaScript sin frameworks (`public/`).
- **Backend**: Node.js con el módulo `http` nativo y el cliente `pg` (`server/`).
- **Base de datos**: PostgreSQL 13 o superior (`db/`). El navegador **nunca** se conecta a la base: solo habla con la API.

## Requisitos

- Node.js 20.12 o superior (`node -v`).
- Una instancia de PostgreSQL 13+ a la que puedas conectarte (local, Docker o un proveedor como Neon, Supabase, Render, RDS).

## Instalación paso a paso

### 1. Instalar dependencias

```bash
npm install
```

La única dependencia es `pg`. Si omites este paso, la web mostrará un aviso claro en lugar de fallar en silencio.

### 2. Tener un PostgreSQL y crear la base

Elige una opción.

**a) PostgreSQL ya instalado en tu equipo**

```bash
createdb costo_invisible
```

(o, desde `psql`: `CREATE DATABASE costo_invisible;`)

**b) PostgreSQL con Docker**

```bash
docker run --name costo-pg -e POSTGRES_PASSWORD=cambia_esto -e POSTGRES_DB=costo_invisible -p 5432:5432 -d postgres:16
```

**c) Un proveedor en la nube**: crea la base desde su panel y copia la cadena de conexión que te dan. Probablemente necesites `DATABASE_SSL=true`.

### 3. Configurar la conexión

```bash
cp .env.example .env
```

Edita `.env` y completa `DATABASE_URL` con **tus** datos:

```
DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@HOST:5432/costo_invisible
```

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | **Obligatoria.** Cadena de conexión a tu PostgreSQL. Si la contraseña tiene `@ : / # ?`, codifícalos (`@` → `%40`). |
| `DATABASE_SSL` | `true` si tu proveedor exige conexión cifrada. Por defecto `false`. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Verifica el certificado del servidor (por defecto `true`). |
| `PORT`, `HOST` | Dónde escucha la app (por defecto `127.0.0.1:3000`). |
| `TRUST_PROXY` | `true` solo si está detrás de un proxy inverso de confianza. |

El archivo `.env` está en `.gitignore`. Nunca subas credenciales reales a un repositorio. La aplicación **no trae ninguna credencial** y no simula una conexión: si no logra conectarse, lo dice.

### 4. Crear las tablas y cargar los datos iniciales

```bash
npm run db:init
```

Aplica `db/schema.sql` (tablas, restricciones e índices) y `db/seed.sql` (3 escenarios, 18 momentos, 54 opciones). Es seguro repetirlo.

Alternativa sin Node:

```bash
psql "$DATABASE_URL" -f db/schema.sql -f db/seed.sql
```

Para borrar todo y empezar de cero (incluye las sesiones guardadas, pide confirmación): `npm run db:reset`.

### 5. Ejecutar

```bash
npm start
```

Abre <http://127.0.0.1:3000>. Al arrancar, la terminal indica si PostgreSQL está conectado (`✔ PostgreSQL conectado. Escenarios activos: 3.`) o por qué no (`✖ …`).

Otros comandos: `npm run dev` (reinicia al editar), `npm test` (pruebas unitarias de la lógica y la validación).

## Si algo no funciona

La web muestra una pantalla con el motivo y qué revisar. Los casos más comunes:

| Mensaje | Qué hacer |
|---|---|
| La aplicación no tiene configurada la base de datos | Crea `.env` y define `DATABASE_URL`; reinicia. |
| Falta instalar las dependencias del servidor | Ejecuta `npm install`. |
| No se pudo conectar con la base de datos | PostgreSQL apagado, o host/puerto incorrectos. |
| PostgreSQL rechazó el usuario o la contraseña | Revisa las credenciales de `DATABASE_URL`. |
| La base de datos indicada no existe | Créala con `createdb costo_invisible`. |
| Las tablas todavía no existen | Ejecuta `npm run db:init`. |

## Estructura

```
db/schema.sql      Tablas, claves, restricciones CHECK e índices
db/seed.sql        Escenarios, momentos y opciones iniciales
scripts/init-db.js Crea tablas y carga datos (db:init / db:reset)
server/            API HTTP: rutas, validación, motor del juego, errores, acceso a PostgreSQL
public/            Interfaz (index.html, styles.css, app.js)
test/              Pruebas unitarias (node --test)
```

## API

| Método y ruta | Qué hace |
|---|---|
| `GET /api/health` | Comprueba de verdad la conexión y que existan las tablas. |
| `GET /api/scenarios` | Lista los escenarios activos. |
| `GET /api/scenarios/:slug` | Momentos y opciones de un escenario. No adelanta las consecuencias. |
| `POST /api/sessions` `{ scenario }` | Inicia una sesión anónima (UUID aleatorio). |
| `POST /api/sessions/:id/decisions` `{ momentId, choiceId }` | Guarda una decisión y devuelve su consecuencia y los indicadores. |
| `POST /api/sessions/:id/complete` | Calcula y guarda el recibo invisible. |
| `GET /api/stats[?scenario=slug]` | Estadísticas agregadas y anónimas. |

## Esquema de la base de datos

`scenarios` → `moments` → `choices`, más `sessions`, `decisions` y `session_results`.

- Claves primarias y foráneas; las foráneas compuestas impiden guardar una decisión cuyo momento no pertenece al escenario de la sesión, o cuya opción no pertenece al momento.
- El dinero es `NUMERIC(12,2)`, nunca punto flotante.
- Restricciones `CHECK` en estados, rangos (0–100), coherencia entre categoría y signo del dinero, fechas, etc.
- Índices para las consultas habituales (escenarios activos, sesiones por estado, distribución de decisiones).

## Privacidad y seguridad

- Sin nombres, correos, IP ni cookies: una sesión es solo un UUID aleatorio.
- Las estadísticas solo se publican cuando hay al menos 5 recorridos completados del escenario.
- Todas las consultas son parametrizadas (`$1, $2…`); todo lo recibido se valida antes de tocar la base.
- El servidor recalcula el recibo a partir de las decisiones guardadas: el navegador no puede enviar ni alterar cifras.
- Cabeceras de seguridad (CSP estricta), límite de peticiones por visitante y mensajes de error que nunca revelan credenciales ni consultas.
- Las sesiones sin terminar se marcan como abandonadas tras 24 horas.

## Agregar o editar escenarios

Añade filas en `db/seed.sql` (con ids nuevos) y ejecuta `npm run db:init`, o inserta directamente en las tablas. Un escenario necesita momentos en el orden de `position` (1 a 6) y 2–3 opciones por momento. Procura que cada momento tenga al menos una opción que alcance con el dinero disponible, para que nadie quede sin salida.
