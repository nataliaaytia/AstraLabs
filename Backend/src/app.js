const express = require("express");
const cors = require("cors");
const authRouter = require("./routes/auth");
const usuariosRouter = require("./routes/usuarios");
const salidasRouter = require("./routes/salidas");
const stockRouter = require("./routes/stock");
const mermasRouter = require("./routes/mermas");
const catalogoRouter = require("./routes/catalogo");
const excedentesRouter = require("./routes/excedentes");
const entradasRouter = require("./routes/entradas");
const donantesRouter = require("./routes/donantes");
const reportesRouter = require("./routes/reportes");
const menusRouter = require("./routes/menus");
const planesComidaRouter = require("./routes/planesComida");
const lotesRouter = require("./routes/lotes");
const exportacionesRouter = require("./routes/exportaciones");

//Seguridad
const { autenticar, requiereRol } = require("./middleware/authMiddleware");
const { registrarFiltros } = require("./middleware/logFiltros");

const app = express();
app.use(cors()); // en producción: restringir a los orígenes reales del frontend
app.use(express.json());
app.use(registrarFiltros);

app.get("/health", (req, res) => {
  res.json({ status: "ok", servicio: "API Inventario - AstraLabs" });
});

//exportaciones
app.use(exportacionesRouter);

// Pública: solo el login
app.use("/api/auth", authRouter);

// Todo lo demás exige token válido
app.use("/api/usuarios", autenticar, usuariosRouter);
app.use("/api/salidas", autenticar, salidasRouter);
app.use("/api/articulos", autenticar, stockRouter);
app.use("/api/mermas", autenticar, mermasRouter);
app.use("/api/excedentes", autenticar, excedentesRouter);
app.use("/api/entradas", autenticar, entradasRouter);
app.use("/api/donantes", autenticar, donantesRouter);
app.use("/api/reportes", autenticar, reportesRouter);
app.use("/api/menus", autenticar, menusRouter);
app.use("/api/planes-comida", autenticar, planesComidaRouter);
app.use("/api/lotes", autenticar, lotesRouter);
app.use("/api", autenticar, catalogoRouter);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () =>
    console.log(`API Inventario escuchando en puerto ${PORT}`),
  );
}

module.exports = app;
