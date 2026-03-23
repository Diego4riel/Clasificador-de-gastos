require('dotenv').config();
const express = require('express');
const path = require("path");
const app = express();
const port = 3000;

const Gasto = require("./src/models/gasto");
const gastoRoutes = require("./src/routes/gastoRoutes");

app.use(express.static("public"));
app.use(express.json()); 

app.use("/api/gastos", gastoRoutes);
console.log("Rutas de gastos cargadas");

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});