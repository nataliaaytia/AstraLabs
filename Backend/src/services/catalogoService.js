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

module.exports = { listarCategorias, listarArticulos };
