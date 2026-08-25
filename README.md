# 💸 Clasificador de Gastos con IA

Sube un CSV con tus gastos y deja que la inteligencia artificial los categorice automáticamente: Alimentación, Transporte, Salud, Entretenimiento, Educación, Hogar u Otros. Sin planillas manuales, sin etiquetar uno por uno.

![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933?logo=node.js&logoColor=white)
![SQLite](https://img.shields.io/badge/DB-SQLite3-003B57?logo=sqlite&logoColor=white)
![IA](https://img.shields.io/badge/IA-OpenRouter-8A2BE2)
![Licencia](https://img.shields.io/badge/Licencia-ISC-lightgrey)

---

## ✨ ¿Qué hace?

1. Subes un archivo `.csv` con tus movimientos (fecha, descripción, monto).
2. El backend parsea cada fila y le pregunta a un modelo de IA en qué categoría encaja según su descripción.
3. Los gastos clasificados se guardan en una base de datos SQLite.
4. El frontend los muestra en una tabla con estadísticas en tiempo real: total de gastos, monto acumulado y número de categorías detectadas.

## 🧱 Stack

| Capa              | Tecnología                                                       |
| ----------------- | ---------------------------------------------------------------- |
| Servidor          | Node.js + Express 5                                              |
| Base de datos     | SQLite3                                                          |
| Carga de archivos | Multer                                                           |
| Parseo de CSV     | csv-parser                                                       |
| Clasificación     | OpenRouter API (modelo `nvidia/nemotron-3-super-120b-a12b:free`) |
| Frontend          | HTML + CSS + JS vanilla                                          |

## 📁 Estructura del proyecto

```
Clasificador-de-gastos/
├── app.js                     # Punto de entrada del servidor
├── public/                    # Frontend estático (HTML, CSS, JS)
├── src/
│   ├── controllers/           # Lógica de negocio (subida y clasificación de CSV)
│   ├── db/                    # Conexión y esquema de SQLite
│   ├── middlewares/           # Configuración de Multer para subir archivos
│   ├── models/                # Acceso a datos (tabla gastos)
│   ├── routes/                # Rutas de la API
│   └── services/               # Cliente de la API de IA (clasificación)
└── uploads/                    # CSVs subidos por los usuarios
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
```

> Consigue una clave gratuita en [openrouter.ai/keys](https://openrouter.ai/keys).

### 4. Levanta el servidor

```bash
node app.js
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

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
