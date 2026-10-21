# 💸 Clasificador de Gastos con IA

Sube un CSV con tus gastos y deja que la inteligencia artificial los categorice automáticamente: Alimentación, Transporte, Salud, Entretenimiento, Educación, Hogar u Otros. Sin planillas manuales, sin etiquetar uno por uno.

![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933?logo=node.js&logoColor=white)
![Turso](https://img.shields.io/badge/DB-Turso%20%2F%20libSQL-4FF8D2)
![IA](https://img.shields.io/badge/IA-OpenRouter-8A2BE2)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)
![Licencia](https://img.shields.io/badge/Licencia-ISC-lightgrey)

---

## ✨ ¿Qué hace?

1. Subes un archivo `.csv` con tus movimientos (fecha, descripción, monto).
2. El backend parsea cada fila y le pregunta a un modelo de IA en qué categoría encaja según su descripción.
3. Los gastos clasificados se guardan en Turso (libSQL), sin depender del disco local.
4. El frontend los muestra en una tabla con estadísticas en tiempo real: total de gastos, monto acumulado y número de categorías detectadas.

## 🧱 Stack

| Capa              | Tecnología                                                       |
| ----------------- | ---------------------------------------------------------------- |
| Servidor          | Node.js + Express 5                                              |
| Base de datos     | Turso (libSQL)                                                   |
| Carga de archivos | Multer con `memoryStorage()` (sin escritura en disco)            |
| Parseo de CSV     | csv-parser                                                       |
| Clasificación     | OpenRouter API (modelo configurable, por defecto `meta-llama/llama-3.3-70b-instruct`) |
| Frontend          | HTML + CSS + JS vanilla                                          |
| Deploy            | Vercel (Serverless Functions)                                    |

## 📁 Estructura del proyecto

```
Clasificador-de-gastos/
├── app.js                     # Punto de entrada del servidor
├── vercel.json                # Configuración de despliegue
├── public/                    # Frontend estático (HTML, CSS, JS)
└── src/
    ├── controllers/           # Lógica de negocio (subida y clasificación de CSV)
    ├── db/                    # Conexión y esquema de Turso
    ├── middlewares/           # Multer en memoria y validación de sesión
    ├── models/                # Acceso a datos (tabla gastos)
    ├── routes/                # Rutas de la API
    └── services/              # Cliente de la API de IA (clasificación)
```

## 🚀 Cómo correrlo

### 1. Clona el repositorio

```bash
git clone https://github.com/Diego4riel/Clasificador-de-gastos
cd clasificador-gastos
```

### 2. Instala las dependencias

```bash
npm install
```

### 3. Configura las variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```
OPENROUTER_API_KEY=tu_clave_aqui
# Opcional: cambia el modelo sin tocar el código
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct

TURSO_DATABASE_URL=libsql://tu-base.turso.io
TURSO_AUTH_TOKEN=tu_token_de_turso
```

> Consigue una clave de OpenRouter en [openrouter.ai/keys](https://openrouter.ai/keys) y crea una base en [turso.tech](https://turso.tech).

### 4. Levanta el servidor

```bash
node app.js
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### 5. Despliegue en Vercel

Configura estas variables en **Project Settings → Environment Variables**:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (opcional)
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

El proyecto incluye `vercel.json` y `app.js` exporta la app como Serverless Function. Los CSV se procesan en memoria con `memoryStorage()`, por lo que no se escribe nada en el disco de Vercel.

## 📄 Formato del CSV esperado

El archivo debe tener columnas equivalentes a estas (los nombres se normalizan automáticamente, ignorando tildes y mayúsculas):

```csv
fecha,descripcion,monto
2026-01-03,Pago de Luz Enel,-26505
2026-01-10,Compra en Amazon,-36491
```

## 🔌 Endpoints de la API

| Método | Ruta                 | Descripción                                         |
| ------ | -------------------- | --------------------------------------------------- |
| `GET`  | `/api/gastos`        | Devuelve todos los gastos registrados               |
| `POST` | `/api/gastos/upload` | Sube un CSV (campo `archivo`) y lo clasifica con IA |

## 🗺️ Roadmap

- [ ] Manejo de errores más descriptivo si la API de IA falla
- [ ] Gráficos de gasto por categoría
- [ ] Exportar resultados clasificados a CSV/Excel
- [ ] Edición manual de categoría desde la interfaz

## 📝 Licencia

ISC
