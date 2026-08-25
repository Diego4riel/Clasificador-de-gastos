const db = require("../db/database");

class Gasto {

  static crear(gasto, callback) {
    const { fecha, descripcion, monto, categoria } = gasto;

    const query = `
      INSERT INTO gastos (fecha, descripcion, monto, categoria)
      VALUES (?, ?, ?, ?)
    `;

    db.run(query, [fecha, descripcion, monto, categoria], function(err) {
      callback(err, this?.lastID);
    });
  }

  static obtenerTodos(callback) {
    const query = `SELECT * FROM gastos`;

    db.all(query, [], (err, rows) => {
      callback(err, rows);
    });
  }

  static borrarTodos(callback) {
    db.run(`DELETE FROM gastos`, [], (err) => {
      if (err) return callback(err);
      // Reinicia el contador autoincremental para que el próximo gasto empiece en ID 1
      db.run(`DELETE FROM sqlite_sequence WHERE name = 'gastos'`, [], (err2) => {
        callback(err2);
      });
    });
  }

}

module.exports = Gasto;