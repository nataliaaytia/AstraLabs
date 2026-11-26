const reporteRepository = require("../repositories/reporteRepository");

/**
 * Servicio de Reportes (RF-21): necesidades críticas de inventario,
 * para que la Administradora sepa qué solicitar con prioridad.
 */
async function obtenerNecesidadesCriticas({ limite } = {}) {
  let limiteNumerico;

  if (limite !== undefined && limite !== null && limite !== "") {
    limiteNumerico = Number(limite);
    if (!Number.isInteger(limiteNumerico) || limiteNumerico <= 0) {
      throw new Error("limite debe ser un número entero positivo");
    }
  }

  const articulos = await reporteRepository.obtenerNecesidadesCriticas({
    limite: limiteNumerico,
  });

  return articulos.map((a) => ({
    articulo_id: a.articulo_id,
    articulo: a.articulo,
    stock_actual: Number(a.stock_actual),
    stock_minimo: Number(a.stock_minimo),
    deficit: Number(a.deficit),
    // % de cuánto cubre el stock actual contra el mínimo requerido (0 = sin nada, 100 = al mínimo)
    porcentaje_cubierto: Math.round(
      (Number(a.stock_actual) / Number(a.stock_minimo)) * 100,
    ),
  }));
}

module.exports = { obtenerNecesidadesCriticas };
