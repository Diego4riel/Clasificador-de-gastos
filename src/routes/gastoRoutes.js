const express = require("express");
const router = express.Router();
const gastoController = require("../controllers/gastoController");
const upload = require('../middlewares/upload');


router.post("/", gastoController.crearGasto);
router.get("/", gastoController.obtenerGastos);
router.post("/upload", upload.single('archivo'), gastoController.subirCSV);
module.exports = router;