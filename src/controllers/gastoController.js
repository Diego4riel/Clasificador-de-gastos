const { Readable } = require("stream");
const csv = require("csv-parser");
const Gasto = require("../models/gasto");
const { clasificarLote, mapearColumnas } = require("../services/iaService");

const TAMANO_LOTE = 15;

const leerCsvDesdeBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const filas = [];

    Readable.from([buffer])
      .pipe(
        csv({
          separator: ",",
          bom: true,
          mapHeaders: ({ header }) => header.trim(),
        }),
      )
      .on("data", (fila) => filas.push(fila))
      .on("end", () => resolve(filas))
      .on("error", reject);
  });

const crearGasto = (req, res) => {
  res.send("crear gasto");
};

const obtenerGastos = async (req, res) => {
  try {
    const gastos = await Gasto.obtenerTodos(req.sessionId ?? null);
    res.json(gastos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const borrarGastos = async (req, res) => {
  try {
    await Gasto.borrarTodos(req.sessionId ?? null);
    res.json({ mensaje: "Historial de gastos borrado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const subirCSV = async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: "No se recibió ningún archivo CSV." });
  }

  try {
    const resultados = await leerCsvDesdeBuffer(req.file.buffer);

    if (resultados.length === 0) {
      return res.status(400).json({ error: "El CSV está vacío." });
    }

    const encabezados = Object.keys(resultados[0]);
    console.log("Columnas detectadas:", encabezados);

    const mapa = await mapearColumnas(encabezados);
    console.log("Mapa generado:", mapa);

    if (mapa.error) {
      return res.status(400).json({ error: mapa.error });
    }

    if (!mapa.fecha || !mapa.descripcion || !mapa.monto) {
      throw new Error(
        `Mapa incompleto devuelto por la IA: ${JSON.stringify(mapa)}`,
      );
    }

    let errores = 0;

    for (let i = 0; i < resultados.length; i += TAMANO_LOTE) {
      const lote = resultados.slice(i, i + TAMANO_LOTE);
      const descripciones = lote.map(
        (row) => row[mapa.descripcion] || "Sin descripción",
      );

      console.log(`Clasificando lote ${i + 1}-${i + lote.length}...`);

      try {
        const categorias = await clasificarLote(descripciones);

        const gastos = lote.map((row, j) => {
          const montoStr = String(row[mapa.monto] ?? "0");
          const montoRaw = montoStr.replace(/[^\d.-]/g, "");

          return {
            descripcion: row[mapa.descripcion] || "Sin descripción",
            monto: parseFloat(montoRaw) || 0,
            fecha: row[mapa.fecha] || "Sin fecha",
            categoria: categorias[j] || "Otros",
          };
        });

        await Gasto.crearVarios(gastos, req.sessionId ?? null);
      } catch (err) {
        console.error("Error al procesar lote:", err.message);
        errores += lote.length;
      }
    }

    return res.json({
      mensaje: "CSV procesado dinámicamente",
      total: resultados.length,
      errores,
    });
  } catch (error) {
    console.error("Fallo crítico en subida:", error);
    return res.status(500).json({ error: `Fallo interno: ${error.message}` });
  }
};

module.exports = { crearGasto, obtenerGastos, borrarGastos, subirCSV };
