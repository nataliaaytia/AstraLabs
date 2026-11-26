const express = require("express");
const planComidaService = require("../services/planComidaService");
const { requiereRol } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const planes = await planComidaService.listarPlanes({
      fecha: req.query.fecha,
      desde: req.query.desde,
      hasta: req.query.hasta,
      tipoComida: req.query.tipo_comida,
      estado: req.query.estado,
    });
    res.json(planes);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post(
  "/",
  requiereRol("Administradora", "Almacen_Cocina"),
  async (req, res) => {
    const { fecha, tipoComida, menuId, comensales } = req.body;
    const usuarioId = req.usuario.id;
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
  },
);

router.get(
  "/:id/faltantes",
  requiereRol("Administradora", "Almacen_Cocina"),
  async (req, res) => {
    try {
      res.json(await planComidaService.obtenerFaltantesPlan(req.params.id));
    } catch (err) {
      const estado = err.message === "El plan de comidas no existe" ? 404 : 400;
      res.status(estado).json({ error: err.message });
    }
  },
);

router.post(
  "/:id/confirmar",
  requiereRol("Administradora", "Almacen_Cocina"),
  async (req, res) => {
    try {
      const plan = await planComidaService.confirmarPlan({
        planId: req.params.id,
        usuarioId: req.usuario.id,
      });
      res.json(plan);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

module.exports = router;
