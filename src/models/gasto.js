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

}

module.exports = Gasto;