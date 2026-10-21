require('dotenv').config();
const { createClient } = require('@libsql/client');

// En Vercel: TURSO_DATABASE_URL (libsql://...) y TURSO_AUTH_TOKEN.
// En local puedes usar TURSO_DATABASE_URL=file:local.db (sin token).
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let initPromise;

// Crea el esquema una sola vez por instancia. Llamar con `await init()` antes de consultar.
function init() {
  if (!initPromise) {
    initPromise = (async () => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS gastos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          fecha TEXT NOT NULL,
          descripcion TEXT NOT NULL,
          monto REAL NOT NULL,
          categoria TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_gastos_session ON gastos(session_id)`
      );
    })().catch((err) => {
      initPromise = null; // permite reintentar si falló
      throw err;
    });
  }
  return initPromise;
}

module.exports = { db, init };
