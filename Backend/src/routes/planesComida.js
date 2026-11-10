const express = require("express");
const planComidaService = require("../services/planComidaService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const planes = await planComidaService.listarPlanes({
      fecha: req.query.fecha,
    });
    res.json(planes);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  const { fecha, tipoComida, menuId, comensales, usuarioId } = req.body;
  try {
    const plan = await planComidaService.registrarPlan({
      fecha,
      tipoComida,
      menuId,
      comensales,
      usuarioId,
    });
    res.status(201).json(plan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
