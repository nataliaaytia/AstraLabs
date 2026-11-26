const express = require("express");
const movimientoRepository = require("../repositories/movimientoRepository");
const { requiereRol } = require("../middleware/authMiddleware");

const router = express.Router();

const TIPOS = ["entrada", "salida", "merma", "excedente", "ajuste"];
const LIMITE_POR_DEFECTO = 2000;
const LIMITE_MAXIMO = 5000;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Historial de movimientos para los reportes. Solo Administradora.
// ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&tipo=&limite=
router.get("/", requiereRol("Administradora"), async (req, res) => {
  const { desde, hasta, tipo } = req.query;
  try {
    if (desde && !FECHA.test(desde)) throw new Error("desde debe ser YYYY-MM-DD");
    if (hasta && !FECHA.test(hasta)) throw new Error("hasta debe ser YYYY-MM-DD");
    if (desde && hasta && desde > hasta) {
      throw new Error("desde no puede ser mayor que hasta");
    }
    if (tipo && !TIPOS.includes(tipo)) {
      throw new Error(`tipo debe ser uno de: ${TIPOS.join(", ")}`);
    }
    let limite = LIMITE_POR_DEFECTO;
    if (req.query.limite !== undefined && req.query.limite !== "") {
      limite = Number(req.query.limite);
      if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) {
        throw new Error(`limite debe ser un entero entre 1 y ${LIMITE_MAXIMO}`);
      }
    }
    const filas = await movimientoRepository.listarMovimientos({
      desde,
      hasta,
      tipo,
      limite,
    });
    res.json(filas.map((f) => ({ ...f, cantidad: Number(f.cantidad) })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
