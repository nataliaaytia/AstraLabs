const express = require("express");
const { descontarPorFEFO } = require("./services/fefoService");

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", servicio: "API Inventario - AstraLabs" });
});

/**
 * Endpoint de ejemplo: simula una salida de inventario aplicando FEFO.
 * RF-03 (Registrar salidas) + RF-20 (priorizar por vencimiento).
 * En produccion, los lotes vendrian de la Capa de Repositorios (PostgreSQL).
 */
app.post("/api/salidas/simular-fefo", (req, res) => {
  const { lotes, cantidad } = req.body;
  try {
    const movimientos = descontarPorFEFO(lotes, cantidad);
    res.json({ movimientos });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`API Inventario escuchando en puerto ${PORT}`));
}

module.exports = app;
