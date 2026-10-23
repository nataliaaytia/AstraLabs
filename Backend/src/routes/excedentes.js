const express = require("express");
const excedenteService = require("../services/excedenteService");

const router = express.Router();

router.post("/", async (req, res) => {
  const { articuloId, cantidad, usuarioId, destino } = req.body;
  try {
    const resultado = await excedenteService.registrarExcedente({
      articuloId,
      cantidad,
      usuarioId,
      destino,
    });
    res.status(201).json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
