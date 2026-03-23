const fs = require('fs');
const csv = require('csv-parser');
const Gasto = require("../models/gasto");
const { clasificarGasto } = require('../services/iaService');

const crearGasto = (req, res) => {
  res.send("crear gasto");
};

const obtenerGastos = (req, res) => {
  Gasto.obtenerTodos((err, gastos) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(gastos);
  });
};

const subirCSV = async (req, res) => {  
  const resultados = [];

  fs.createReadStream(req.file.path)
    .pipe(csv({ separator: ',', bom: true, mapHeaders: ({ header }) => header.trim() }))
    .on('data', (data) => resultados.push(data))
    .on('end', async () => {  

      let errores = 0;

      for (const row of resultados) {  
        try {
          const categoria = await clasificarGasto(row.descripcion); 

          const gasto = {
            descripcion: row.descripcion,
            monto: parseFloat(row.monto),
            fecha: row.fecha,
            categoria  
          };

          await new Promise((resolve, reject) => {
            Gasto.crear(gasto, (err) => err ? reject(err) : resolve());
          });

        } catch (err) {
          console.error("Error:", err.message);
          errores++;
        }
      }

      res.json({
        mensaje: 'CSV procesado con IA',
        total: resultados.length,
        errores
      });
    });
};

module.exports = {
  crearGasto,
  obtenerGastos,
  subirCSV
};