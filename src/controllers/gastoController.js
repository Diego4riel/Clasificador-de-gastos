const fs = require("fs");
const csv = require("csv-parser");
const Gasto = require("../models/gasto");
const { clasificarLote, mapearColumnas } = require("../services/iaService");

const TAMANO_LOTE = 15;

const crearGasto = (req, res) => {
  res.send("crear gasto");
};

const obtenerGastos = (req, res) => {
  Gasto.obtenerTodos((err, gastos) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(gastos);
  });
};

const borrarGastos = (req, res) => {
  Gasto.borrarTodos((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: "Historial de gastos borrado" });
  });
};

const subirCSV = async (req, res) => {
  const resultados = [];

  fs.createReadStream(req.file.path)
    .pipe(
      csv({
        separator: ",",
        bom: true,
        mapHeaders: ({ header }) => header.trim(), // Quita espacios vacíos para evitar bugs
      }),
    )
    .on("data", (data) => resultados.push(data))
    .on("end", async () => {
      if (resultados.length === 0) {
        if (req.file && fs.existsSync(req.file.path))
          fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "El CSV está vacío." });
      }

      let errores = 0;

      try {
        const encabezados = Object.keys(resultados[0]);
        console.log("Columnas detectadas:", encabezados);

        // Validación de importación correcta
        if (typeof mapearColumnas !== "function") {
          throw new Error(
            "mapearColumnas no está definido. Revisa iaService.js",
          );
        }

        const mapa = await mapearColumnas(encabezados);
        console.log("Mapa generado:", mapa);

        // Bloqueo si el archivo no es de finanzas
        if (mapa.error) {
          if (req.file && fs.existsSync(req.file.path))
            fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: mapa.error });
        }

        // Validación de formato devuelto por la IA
        if (!mapa.fecha || !mapa.descripcion || !mapa.monto) {
          throw new Error(
            `Mapa incompleto devuelto por la IA: ${JSON.stringify(mapa)}`,
          );
        }

        for (let i = 0; i < resultados.length; i += TAMANO_LOTE) {
          const lote = resultados.slice(i, i + TAMANO_LOTE);
          const descripciones = lote.map((row) => row[mapa.descripcion]);

          console.log(`Clasificando lote ${i + 1}-${i + lote.length}...`);

          try {
            const categorias = await clasificarLote(descripciones);
            for (let j = 0; j < lote.length; j++) {
              const row = lote[j];
              const categoria = categorias[j] || "Otros";

              const montoStr = String(row[mapa.monto] || "0");
              const montoRaw = montoStr.replace(/[^\d.-]/g, "");

              const gasto = {
                descripcion: row[mapa.descripcion] || "Sin descripción",
                monto: parseFloat(montoRaw) || 0,
                fecha: row[mapa.fecha] || "Sin fecha",
                categoria,
              };

              try {
                await new Promise((resolve, reject) => {
                  Gasto.crear(gasto, (err) => (err ? reject(err) : resolve()));
                });
              } catch (err) {
                errores++;
              }
            }
          } catch (err) {
            console.error("Error al clasificar lote:", err.message);
            errores += lote.length;
          }
        }

        res.json({
          mensaje: "CSV procesado dinámicamente",
          total: resultados.length,
          errores,
        });
      } catch (error) {
        console.error("Fallo crítico en subida:", error);
        // Ahora el frontend recibirá el error EXACTO para mostrarlo en pantalla
        res.status(500).json({ error: `Fallo interno: ${error.message}` });
      } finally {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      }
    });
};

module.exports = { crearGasto, obtenerGastos, borrarGastos, subirCSV };
