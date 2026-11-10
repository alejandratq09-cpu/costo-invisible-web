# El costo invisible de llegar al final del día

> Una experiencia interactiva y anónima para reflexionar sobre el costo real de nuestras decisiones diarias.

[![Estado](https://img.shields.io/badge/estado-en%20vivo-brightgreen)](https://costo-invisible-web.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-20.12%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

## 🎯 Propósito

**El costo invisible de llegar al final del día** no es un juego de ganar o perder. Es una experiencia que busca:

- **Hacer visible lo invisible:** Mostrar que cada decisión tiene un costo en tiempo, energía y bienestar, no solo en dinero.
- **Generar empatía:** Que quienes no viven situaciones de escasez entiendan lo que cuesta llegar al final del día.
- **Dar voz a quienes lo viven:** Que las personas que enfrentan estas decisiones se sientan vistas y representadas.
- **Educar sin juzgar:** No hay respuestas correctas, solo un recibo que te muestra el costo real de tus elecciones.

La experiencia es **anónima**. Los datos que se recogen (de forma agregada) sirven para mostrar cómo decide la gente en situaciones de recursos limitados.

## 🎮 ¿Cómo funciona?

Recorres **seis momentos de un día** (despertar, comer, trasladarse, trabajar o estudiar, atender la salud o un imprevisto, descansar o resolver pendientes). En cada momento debes elegir **una** de las dos o tres opciones disponibles. Cada decisión cambia cuatro indicadores:

- 💰 **Dinero disponible**
- ⏱ **Tiempo restante**
- ⚡ **Energía**
- 💜 **Bienestar**

Al final, recibes un **recibo invisible** con los costos visibles (dinero) e invisibles (tiempo, energía, bienestar). No hay puntaje, ganadores ni perdedores.

## ✨ Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| **Presupuesto personalizado** | Ajusta con cuánto dinero quieres empezar (entre $5.000 y $500.000). |
| **Volver a decidir** | Si te equivocaste, puedes deshacer tu última decisión y elegir otra. |
| **Recibo invisible** | Un resumen visual con todos los costos de tu día. |
| **Descarga en PDF** | Descarga tu recibo como un archivo PDF para compartirlo. |
| **Historial de partidas** | Guarda tus últimos 10 recorridos en tu navegador. |
| **Estadísticas anónimas** | Compara tus decisiones con las de otros jugadores. |
| **Diseño responsive** | Funciona en celular, tablet y computador. |

## 🛠️ Tecnologías

- **Frontend:** HTML, CSS y JavaScript sin frameworks (`public/`). Diseño editorial con tipografía serif y modo oscuro/claro automático.
- **Backend:** Node.js con el módulo `http` nativo y el cliente `pg` (`server/`).
- **Base de datos:** PostgreSQL 13 o superior (`db/`). El navegador **nunca** se conecta a la base: solo habla con la API.

## 📋 Requisitos

- Node.js 20.12 o superior (`node -v`).
- Una instancia de PostgreSQL 13+ a la que puedas conectarte (local, Docker o un proveedor como Neon, Supabase, Render, RDS).

## 🚀 Instalación paso a paso

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/alejandratq09-cpu/costo-invisible-web.git
cd costo-invisible-web
npm install