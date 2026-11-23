const express = require("express");
const entradaService = require("../services/entradaService");
const { requiereRol } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/",
  requiereRol("Administradora", "Recepcion"),
  async (req, res) => {
    const {
      articuloId,
      cantidad,
      donanteId,
      fecha,
      fechaVencimiento,
      numeroLote,
    } = req.body;
    const usuarioId = req.usuario.id;
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
  },
);

router.get(
  "/",
  requiereRol("Administradora", "Recepcion"),
  async (req, res) => {
    try {
      const entradas = await entradaService.listarEntradas({
        desde: req.query.desde,
        hasta: req.query.hasta,
        q: req.query.q?.trim(),
        donanteId: req.query.donante_id,
        limite: req.query.limite,
      });
      res.json(entradas);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

module.exports = router;
