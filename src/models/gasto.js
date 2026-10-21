const { db, init } = require('../db/database');

// Turso solo acepta string, number, bigint, boolean, Buffer/Uint8Array/ArrayBuffer y null.
// Convertimos undefined a null para evitar "Unsupported type of value".
function aValorSql(valor) {
  if (valor === undefined || valor === null) return null;

  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null;
  }

  if (
    typeof valor === 'string' ||
    typeof valor === 'bigint' ||
    typeof valor === 'boolean'
  ) {
    return valor;
  }

  if (
    Buffer.isBuffer(valor) ||
    valor instanceof Uint8Array ||
    valor instanceof ArrayBuffer
  ) {
    return valor;
  }

  throw new TypeError(
    `Tipo de argumento no soportado por Turso: ${typeof valor}`
  );
}

const aArgsSql = (args) => args.map(aValorSql);

class Gasto {
  // Inserta varios gastos en una sola transacción (un solo viaje a la red).
  static async crearVarios(gastos, sessionId) {
    await init();
    if (!gastos.length) return;

    const now = Date.now();
    await db.batch(
      gastos.map((gasto = {}) => {
        const { fecha, descripcion, monto, categoria } = gasto;
        return {
          sql: `INSERT INTO gastos (session_id, fecha, descripcion, monto, categoria, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: aArgsSql([sessionId, fecha, descripcion, monto, categoria, now]),
        };
      }),
      'write'
    );
  }

  static async crear(gasto, sessionId) {
    await init();
    const { fecha, descripcion, monto, categoria } = gasto ?? {};
    const res = await db.execute({
      sql: `INSERT INTO gastos (session_id, fecha, descripcion, monto, categoria, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: aArgsSql([
        sessionId,
        fecha,
        descripcion,
        monto,
        categoria,
        Date.now(),
      ]),
    });
    return Number(res.lastInsertRowid);
  }

  // Solo los gastos de esta sesión.
  static async obtenerTodos(sessionId) {
    await init();
    const res = await db.execute({
      sql: `SELECT id, fecha, descripcion, monto, categoria
            FROM gastos WHERE session_id = ? ORDER BY id`,
      args: aArgsSql([sessionId]),
    });
    return res.rows;
  }

  static async borrarTodos(sessionId) {
    await init();
    await db.execute({
      sql: `DELETE FROM gastos WHERE session_id = ?`,
      args: aArgsSql([sessionId]),
    });
  }

  // Borra datos con más de `horas` horas, de cualquier sesión.
  static async limpiarAntiguos(horas = 24) {
    await init();
    const limite = Date.now() - horas * 60 * 60 * 1000;
    await db.execute({
      sql: `DELETE FROM gastos WHERE created_at < ?`,
      args: aArgsSql([limite]),
    });
  }
}

module.exports = Gasto;
