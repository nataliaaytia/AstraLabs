const express = require("express");
const reporteService = require("../services/reporteService");

const router = express.Router();

router.get("/necesidades-criticas", async (req, res) => {
  try {
    const datos = await reporteService.obtenerNecesidadesCriticas({
      limite: req.query.limite,
    });
    res.json(datos);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
