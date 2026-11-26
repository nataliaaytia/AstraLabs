const express = require("express");
const alertaService = require("../services/alertaService");
const { requiereRol } = require("../middleware/authMiddleware");

const router = express.Router();

// HU-12: panel de alertas (pendientes y atendidas). ?estado=&tipo=&q=&limite=&sincronizar=false
router.get("/", requiereRol("Administradora"), async (req, res) => {
  try {
    res.json(
      await alertaService.listarAlertas({
        estado: req.query.estado,
        tipo: req.query.tipo,
        q: req.query.q?.trim(),
        limite: req.query.limite,
        sincronizar: req.query.sincronizar !== "false",
      }),
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fuerza la sincronización de alertas con el inventario actual.
router.post("/sincronizar", requiereRol("Administradora"), async (req, res) => {
  try {
    res.json(await alertaService.sincronizarAlertas());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marca una alerta pendiente como atendida (queda registrado quién y cuándo).
router.patch(
  "/:id/atender",
  requiereRol("Administradora"),
  async (req, res) => {
    try {
      res.json(
        await alertaService.atenderAlerta(req.params.id, req.usuario.id),
      );
    } catch (err) {
      const estado =
        err.message === "La alerta no existe"
          ? 404
          : err.message === "La alerta ya fue atendida"
            ? 409
            : 400;
      res.status(estado).json({ error: err.message });
    }
  },
);

// Totales de todas las alertas (indicador del panel).
router.get("/resumen", requiereRol("Administradora"), async (req, res) => {
  try {
    res.json(await alertaService.obtenerResumenAlertas());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HU-11: artículos que llegaron a su stock mínimo o quedaron por debajo.
router.get("/stock-minimo", requiereRol("Administradora"), async (req, res) => {
  try {
    res.json(await alertaService.obtenerAlertasStockMinimo());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HU-10: lotes vencidos o próximos a vencer. ?dias=N reemplaza el umbral solo en esa consulta.
router.get("/vencimiento", requiereRol("Administradora"), async (req, res) => {
  try {
    res.json(
      await alertaService.obtenerAlertasVencimiento({ dias: req.query.dias }),
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Umbral configurado (días de anticipación).
router.get(
  "/vencimiento/umbral",
  requiereRol("Administradora"),
  async (req, res) => {
    try {
      res.json(await alertaService.obtenerUmbralVencimiento());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.put(
  "/vencimiento/umbral",
  requiereRol("Administradora"),
  async (req, res) => {
    try {
      res.json(
        await alertaService.configurarUmbralVencimiento((req.body || {}).dias),
      );
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

module.exports = router;
