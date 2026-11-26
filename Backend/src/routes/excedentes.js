const express = require("express");
const excedenteService = require("../services/excedenteService");
const { requiereRol } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const excedentes = await excedenteService.listarExcedentes({
      desde: req.query.desde,
      hasta: req.query.hasta,
      q: req.query.q?.trim(),
    });
    res.json(excedentes);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post(
  "/",
  requiereRol("Administradora", "Almacen_Cocina"),
  async (req, res) => {
    const { articuloId, cantidad, destino, observaciones } = req.body;
    const usuarioId = req.usuario.id;
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
  },
);

module.exports = router;
