const express = require("express");
const catalogoService = require("../services/catalogoService");

const router = express.Router();

router.get("/categorias", async (req, res) => {
  try {
    const categorias = await catalogoService.listarCategorias();
    res.json(categorias);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/articulos", async (req, res) => {
  try {
    const articulos = await catalogoService.listarArticulos({
      categoriaId: req.query.categoria_id,
    });
    res.json(articulos);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/articulos", async (req, res) => {
  const { nombre, categoriaId, unidadMedida, esPerecedero, stockMinimo } =
    req.body;
  try {
    const articulo = await catalogoService.registrarArticulo({
      nombre,
      categoriaId,
      unidadMedida,
      esPerecedero,
      stockMinimo,
    });
    res.status(201).json(articulo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
