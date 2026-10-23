const express = require("express");
const cors = require("cors");
const authRouter = require("./routes/auth");
const usuariosRouter = require("./routes/usuarios");
const salidasRouter = require("./routes/salidas");
const stockRouter = require("./routes/stock");
const mermasRouter = require("./routes/mermas");
const catalogoRouter = require("./routes/catalogo");

const app = express();
app.use(cors()); // en producción: restringir a los orígenes reales del frontend
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", servicio: "API Inventario - AstraLabs" });
});

app.use("/api/auth", authRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/salidas", salidasRouter);
app.use("/api/articulos", stockRouter);
app.use("/api/mermas", mermasRouter);
app.use("/api", catalogoRouter);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () =>
    console.log(`API Inventario escuchando en puerto ${PORT}`),
  );
}

module.exports = app;
