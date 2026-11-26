const express = require("express");
const catalogoService = require("../services/catalogoService");
const { requiereRol } = require("../middleware/authMiddleware");

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
      q: req.query.q?.trim(),
      bajoMinimo: req.query.bajo_minimo === "true",
    });
    res.json(articulos);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/articulos", requiereRol("Administradora"), async (req, res) => {
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

// HU-07: editar un artículo (p. ej. su stock mínimo). Solo Administradora.
router.patch(
  "/articulos/:id",
  requiereRol("Administradora"),
  async (req, res) => {
    try {
      const articulo = await catalogoService.actualizarArticulo(
        req.params.id,
        req.body || {},
      );
      res.json(articulo);
    } catch (err) {
      const estado = err.message === "El artículo no existe" ? 404 : 400;
      res.status(estado).json({ error: err.message });
    }
  },
);

module.exports = router;
