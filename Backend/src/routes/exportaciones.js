const express = require("express");
const { autenticar, requiereRol } = require("../middleware/authMiddleware");
const exportacionService = require("../services/exportacionService");

const router = express.Router();

/**
 * Exportaciones a Excel/PDF (RF-24). Las rutas llevan la URL completa porque
 * este router se monta ANTES que los demás: así "/api/menus/exportar" no es
 * interpretado por "/api/menus/:id".
 *
 * Todas aceptan ?formato=xlsx|pdf (obligatorio) y los mismos filtros que el
 * listado de su pantalla.
 */

function enviarArchivo(res, { buffer, contentType, nombreArchivo }) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
  // Para que el frontend (otro origen) pueda leer el nombre del archivo
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("Content-Length", buffer.length);
  res.send(buffer);
}

const manejar = (generar) => async (req, res) => {
  try {
    enviarArchivo(res, await generar(req.query));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Artículos: cualquier usuario autenticado
router.get(
  "/api/articulos/exportar",
  autenticar,
  manejar((q) =>
    exportacionService.exportarArticulos({
      formato: q.formato,
      categoriaId: q.categoria_id,
      q: q.q?.trim(),
      bajoMinimo: q.bajo_minimo === "true",
    }),
  ),
);

// Menús: Administradora y Almacen_Cocina
router.get(
  "/api/menus/exportar",
  autenticar,
  requiereRol("Administradora", "Almacen_Cocina"),
  manejar((q) =>
    exportacionService.exportarMenus({ formato: q.formato, q: q.q?.trim() }),
  ),
);

// Planes de comida: Administradora y Almacen_Cocina
router.get(
  "/api/planes-comida/exportar",
  autenticar,
  requiereRol("Administradora", "Almacen_Cocina"),
  manejar((q) =>
    exportacionService.exportarPlanes({
      formato: q.formato,
      mes: q.mes,
      fecha: q.fecha,
      desde: q.desde,
      hasta: q.hasta,
      tipoComida: q.tipo_comida,
      estado: q.estado,
    }),
  ),
);

// Reporte de necesidades críticas: solo Administradora
router.get(
  "/api/reportes/necesidades-criticas/exportar",
  autenticar,
  requiereRol("Administradora"),
  manejar((q) =>
    exportacionService.exportarNecesidadesCriticas({
      formato: q.formato,
      limite: q.limite,
    }),
  ),
);

module.exports = router;
