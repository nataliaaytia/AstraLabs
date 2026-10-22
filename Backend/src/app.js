const express = require("express");
const salidasRouter = require("./routes/salidas");
const stockRouter = require("./routes/stock");

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", servicio: "API Inventario - AstraLabs" });
});

// RF-03: registrar salidas de inventario
app.use("/api/salidas", salidasRouter);

app.use("/api/articulos", stockRouter);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () =>
    console.log(`API Inventario escuchando en puerto ${PORT}`),
  );
}

module.exports = app;
