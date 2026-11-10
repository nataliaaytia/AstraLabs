const express = require("express");
const menuService = require("../services/menuService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const menus = await menuService.listarMenus();
    res.json(menus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const menu = await menuService.obtenerMenu(req.params.id);
    res.json(menu);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  const { nombre, descripcion, ingredientes } = req.body;
  try {
    const menu = await menuService.registrarMenu({
      nombre,
      descripcion,
      ingredientes,
    });
    res.status(201).json(menu);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
