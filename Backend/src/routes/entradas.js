const express = require("express");
const entradaService = require("../services/entradaService");

const router = express.Router();

router.post("/", async (req, res) => {
  const {
    articuloId,
    cantidad,
    usuarioId,
    donanteId,
    fecha,
    fechaVencimiento,
    numeroLote,
  } = req.body;
  try {
    const resultado = await entradaService.registrarEntrada({
      articuloId,
      cantidad,
      usuarioId,
      donanteId,
      fecha,
      fechaVencimiento,
      numeroLote,
    });
    res.status(201).json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
