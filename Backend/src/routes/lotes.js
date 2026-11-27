const express = require("express");
const loteRepository = require("../repositories/loteRepository");
const { requiereRol } = require("../middleware/authMiddleware");
const router = express.Router();

const ESTADOS_LOTE = ["vencido", "por_vencer", "vigente", "sin_asignar"];

router.get("/", async (req, res) => {
  const { articuloId, q, estado } = req.query;
  if (
    articuloId !== undefined &&
    !(Number.isInteger(Number(articuloId)) && Number(articuloId) > 0)
  ) {
    return res
      .status(400)
      .json({ error: "articuloId debe ser un entero positivo" });
  }
  if (estado !== undefined && !ESTADOS_LOTE.includes(estado)) {
    return res
      .status(400)
      .json({ error: `estado debe ser uno de: ${ESTADOS_LOTE.join(", ")}` });
  }
  try {
    res.json(
      await loteRepository.listarLotes({ articuloId, q: q?.trim(), estado }),
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/asignar",
  requiereRol("Administradora", "Recepcion", "Almacen_Cocina"),
  async (req, res) => {
    try {
      const { articuloId, codigo, fechaVencimiento } = req.body;
      const cantidad = Number(req.body.cantidad);
      if (
        !Number.isInteger(Number(articuloId)) ||
        Number(articuloId) <= 0 ||
        !codigo?.trim() ||
        codigo.trim().toUpperCase() === "SIN-ASIGNAR" ||
        !Number.isFinite(cantidad) ||
        cantidad <= 0 ||
        Math.round(cantidad * 100) !== cantidad * 100 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fechaVencimiento || "") ||
        !Number.isFinite(Date.parse(`${fechaVencimiento}T12:00:00`)) ||
        fechaVencimiento < new Date().toISOString().slice(0, 10)
      ) {
        return res.status(400).json({
          error:
            "Completa un artículo, código, cantidad (máximo 2 decimales) y fecha de vencimiento válida",
        });
      }
      const lote = await loteRepository.asignarLote({
        articuloId: Number(articuloId),
        codigo: codigo.trim().toUpperCase(),
        cantidad,
        fechaVencimiento,
      });
      res.status(201).json(lote);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);
module.exports = router;
