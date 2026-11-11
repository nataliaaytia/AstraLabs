const catalogoRepository = require("../repositories/catalogoRepository");

/**
 * Servicio de Catálogo (RF-01, RF-07).
 */
async function listarCategorias() {
  return catalogoRepository.listarCategorias();
}

async function listarArticulos({ categoriaId } = {}) {
  if (categoriaId !== undefined && categoriaId !== null) {
    const idNumerico = Number(categoriaId);
    if (!Number.isInteger(idNumerico) || idNumerico <= 0) {
      throw new Error("categoriaId debe ser un número entero positivo");
    }
    return catalogoRepository.listarArticulos({ categoriaId: idNumerico });
  }
  return catalogoRepository.listarArticulos({});
}

async function registrarArticulo({
  nombre,
  categoriaId,
  unidadMedida,
  esPerecedero = false,
  stockMinimo = 0,
}) {
  const nombreLimpio = String(nombre || "").trim().replace(/\s+/g, " ");
  if (!nombreLimpio) {
    throw new Error("nombre es obligatorio");
  }

  const categoria = Number(categoriaId);
  if (!Number.isInteger(categoria) || categoria <= 0) {
    throw new Error("categoriaId debe ser un número entero positivo");
  }

  if (!unidadMedida || !String(unidadMedida).trim()) {
    throw new Error("unidadMedida es obligatoria");
  }

  const minimo = Number(stockMinimo);
  if (!Number.isFinite(minimo) || minimo < 0) {
    throw new Error("stockMinimo debe ser un número mayor o igual a cero");
  }

  try {
    return await catalogoRepository.crearArticulo({
      nombre: nombreLimpio,
      categoriaId: categoria,
      unidadMedida: String(unidadMedida).trim(),
      esPerecedero: Boolean(esPerecedero),
      stockMinimo: minimo,
    });
  } catch (err) {
    if (err.code === "23505") {
      throw new Error("Ya existe un artículo con ese nombre en esta categoría");
    }
    if (err.code === "23503") {
      throw new Error("La categoría seleccionada no existe");
    }
    throw err;
  }
}

module.exports = { listarCategorias, listarArticulos, registrarArticulo };
