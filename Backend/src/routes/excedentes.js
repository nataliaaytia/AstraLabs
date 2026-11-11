const express = require("express");
const excedenteService = require("../services/excedenteService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const excedentes = await excedenteService.listarExcedentes();
    res.json(excedentes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  const { articuloId, cantidad, usuarioId, destino, observaciones } = req.body;
  try {
    const resultado = await excedenteService.registrarExcedente({
      articuloId,
      cantidad,
      usuarioId,
      destino,
      observaciones,
    });
    res.status(201).json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
