const { descontarPorFEFO } = require("./fefoService");
const inventarioRepository = require("../repositories/inventarioRepository");

/**
 * Servicio de Salidas y Consumo (ver Modelo C4 - Nivel 3).
 *
 * Cubre RF-03: registrar una salida con fecha, destino/consumo, artículo
 * y cantidad; reflejando el consumo real del comedor.
 *
 * No decide de qué lote sale el stock por su cuenta: eso lo resuelve
 * el Gestor de Inventario y FEFO (fefoService), siguiendo ADR-01.
 */
async function registrarSalida({ articuloId, cantidad, usuarioId, destino }) {
  if (!articuloId || !usuarioId) {
    throw new Error("articuloId y usuarioId son obligatorios");
  }
  if (!destino) {
    throw new Error("destino es obligatorio para registrar una salida (RF-03)");
  }

  const lotes = await inventarioRepository.obtenerLotesConStock(articuloId);
  const movimientosFEFO = descontarPorFEFO(lotes, cantidad);

  const movimientoId = await inventarioRepository.registrarSalida({
    articuloId,
    cantidadTotal: cantidad,
    usuarioId,
    destino,
    movimientosFEFO,
  });

  return { movimientoId, detalle: movimientosFEFO };
}

module.exports = { registrarSalida };
