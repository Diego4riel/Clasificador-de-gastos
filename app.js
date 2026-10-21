require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

const gastoRoutes = require("./src/routes/gastoRoutes");

// Usar ruta absoluta para los archivos estáticos
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.use("/api/gastos", gastoRoutes);
console.log("Rutas de gastos cargadas");

// Ruta raíz explícita para asegurar que sirva el index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, req, res, next) => {
  const esMulter = err?.name === "MulterError";
  const status = esMulter
    ? err.code === "LIMIT_FILE_SIZE"
      ? 413
      : 400
    : err?.status || 500;
  const mensaje =
    err?.code === "LIMIT_FILE_SIZE"
      ? "El archivo supera el límite de 4 MB."
      : err?.message || "Error interno del servidor.";

  if (status >= 500) {
    console.error("Error no controlado:", err);
  }

  res.status(status).json({ error: mensaje });
});

// Solo levantar el servidor cuando se ejecuta localmente.
if (!process.env.VERCEL && require.main === module) {
  app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
  });
}

// Exportar la app para que Vercel la use como Serverless Function.
module.exports = app;
