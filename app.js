require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

const Gasto = require("./src/models/gasto");
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

// IMPORTANTE: Solo ejecutar app.listen si NO estamos en Vercel (entorno local)
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
  });
}

// Exportar la app para que Vercel la pueda usar como Serverless Function
module.exports = app;
