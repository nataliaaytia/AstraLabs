const catalogoRepository = require("../repositories/catalogoRepository");

/**
 * Servicio de Catálogo (RF-01, RF-07).
 */
async function listarCategorias() {
  return catalogoRepository.listarCategorias();
}

async function listarArticulos({ categoriaId, q, bajoMinimo } = {}) {
  const filtros = { q, bajoMinimo };
  if (categoriaId !== undefined && categoriaId !== null) {
    const idNumerico = Number(categoriaId);
    if (!Number.isInteger(idNumerico) || idNumerico <= 0) {
      throw new Error("categoriaId debe ser un número entero positivo");
    }
    return catalogoRepository.listarArticulos({
      ...filtros,
      categoriaId: idNumerico,
    });
  }
  return catalogoRepository.listarArticulos(filtros);
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

async function actualizarArticulo(id, datos = {}) {
  const articuloId = Number(id);
  if (!Number.isInteger(articuloId) || articuloId <= 0) {
    throw new Error("id debe ser un número entero positivo");
  }

  const campos = {};

  if (datos.nombre !== undefined) {
    const nombre = String(datos.nombre || "").trim().replace(/\s+/g, " ");
    if (!nombre) throw new Error("nombre no puede estar vacío");
    campos.nombre = nombre;
  }
  if (datos.categoriaId !== undefined) {
    const categoria = Number(datos.categoriaId);
    if (!Number.isInteger(categoria) || categoria <= 0) {
      throw new Error("categoriaId debe ser un número entero positivo");
    }
    campos.categoria_id = categoria;
  }
  if (datos.unidadMedida !== undefined) {
    const unidad = String(datos.unidadMedida || "").trim();
    if (!unidad) throw new Error("unidadMedida no puede estar vacía");
    campos.unidad_medida = unidad;
  }
  if (datos.esPerecedero !== undefined) {
    if (typeof datos.esPerecedero !== "boolean") {
      throw new Error("esPerecedero debe ser verdadero o falso");
    }
    campos.es_perecedero = datos.esPerecedero;
  }
  if (datos.stockMinimo !== undefined) {
    const minimo = Number(datos.stockMinimo);
    if (
      datos.stockMinimo === null ||
      datos.stockMinimo === "" ||
      !Number.isFinite(minimo) ||
      minimo < 0
    ) {
      throw new Error("stockMinimo debe ser un número mayor o igual a cero");
    }
    campos.stock_minimo = minimo;
  }

  if (Object.keys(campos).length === 0) {
    throw new Error(
      "Indica al menos un campo a modificar (stockMinimo, nombre, categoriaId, unidadMedida, esPerecedero)",
    );
  }

  try {
    const articulo = await catalogoRepository.actualizarArticulo(
      articuloId,
      campos,
    );
    if (!articulo) throw new Error("El artículo no existe");
    return { ...articulo, stock_minimo: Number(articulo.stock_minimo) };
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

module.exports = {
  listarCategorias,
  listarArticulos,
  registrarArticulo,
  actualizarArticulo,
};
