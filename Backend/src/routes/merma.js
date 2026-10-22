const express = require("express");
const mermaService = require("../services/mermaService");

const router = express.Router();

/**
 * POST /api/mermas
 * RF-06: registra una merma con motivo (vencimiento, deterioro, pérdida).
 *
 * Body esperado:
 *   { articuloId: number, cantidad: number, usuarioId: number, motivo: string }
 */
router.post("/", async (req, res) => {
  const { articuloId, cantidad, usuarioId, motivo } = req.body;

  try {
    const resultado = await mermaService.registrarMerma({
      articuloId,
      cantidad,
      usuarioId,
      motivo,
    });
    res.status(201).json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
