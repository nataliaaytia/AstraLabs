const express = require("express");
const reporteService = require("../services/reporteService");
const { requiereRol } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/necesidades-criticas",
  requiereRol("Administradora"),
  async (req, res) => {
    try {
      const datos = await reporteService.obtenerNecesidadesCriticas({
        limite: req.query.limite,
      });
      res.json(datos);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

module.exports = router;
