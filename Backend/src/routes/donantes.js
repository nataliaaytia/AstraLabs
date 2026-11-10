const express = require("express");
const donanteService = require("../services/donanteService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const donantes = await donanteService.listarDonantes();
    res.json(donantes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  const { nombre, tipo, contacto, telefono, email } = req.body;
  try {
    const donante = await donanteService.registrarDonante({
      nombre,
      tipo,
      contacto,
      telefono,
      email,
    });
    res.status(201).json(donante);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
