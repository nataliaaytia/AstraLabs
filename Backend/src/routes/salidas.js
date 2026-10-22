const express = require("express");
const salidaService = require("../services/salidaService");

const router = express.Router();

/**
 * POST /api/salidas
 * RF-03: registra una salida con fecha, destino/consumo, artículo y cantidad.
 *
 * Body esperado:
 *   { articuloId: number, cantidad: number, usuarioId: number, destino: string }
 */
router.post("/", async (req, res) => {
  const { articuloId, cantidad, usuarioId, destino } = req.body;

  try {
    const resultado = await salidaService.registrarSalida({
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
