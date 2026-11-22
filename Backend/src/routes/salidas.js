const express = require("express");
const salidaService = require("../services/salidaService");
const { requiereRol } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * POST /api/salidas
 * RF-03: registra una salida con fecha, destino/consumo, artículo y cantidad.
 *
 * Body esperado:
 *   { articuloId: number, cantidad: number, usuarioId: number, destino: string }
 */
router.post(
  "/",
  requiereRol("Administradora", "Almacen_Cocina"),
  async (req, res) => {
    const { articuloId, cantidad, destino } = req.body;
    const usuarioId = req.usuario.id;

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
  },
);

module.exports = router;
