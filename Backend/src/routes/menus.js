const express = require("express");
const menuRepository = require("../repositories/menuRepository");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const menus = await menuRepository.listarMenus();
    res.json(menus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
