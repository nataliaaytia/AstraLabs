const express = require("express");
const inventarioRepository = require("../repositories/inventarioRepository");

const router = express.Router();

/**
 * GET /api/articulos/:id/stock
 * RF-05: expone el stock actual, recalculado automáticamente
 * por el trigger de base de datos en cada entrada/salida.
 */
router.get("/:id/stock", async (req, res) => {
  const articuloId = Number(req.params.id);

  try {
    const stock = await inventarioRepository.obtenerStockArticulo(articuloId);
    if (!stock) {
      return res.status(404).json({ error: "Artículo no encontrado" });
    }
    res.json(stock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
