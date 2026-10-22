const { descontarPorFEFO } = require("./fefoService");
const inventarioRepository = require("../repositories/inventarioRepository");

const MOTIVOS_VALIDOS = ["vencimiento", "deterioro", "perdida"];

/**
 * Servicio de Mermas y Ajustes (ver Modelo C4 - Nivel 3).
 *
 * Cubre RF-06: registrar una merma con motivo (vencimiento, deterioro,
 * pérdida), justificando bajas de inventario.
 *
 * Igual que Salidas (HU-03), no decide de qué lote sale el stock por
 * su cuenta: eso lo resuelve el Gestor de Inventario y FEFO (ADR-01).
 */
async function registrarMerma({ articuloId, cantidad, usuarioId, motivo }) {
  if (!articuloId || !usuarioId) {
    throw new Error("articuloId y usuarioId son obligatorios");
  }
  if (!MOTIVOS_VALIDOS.includes(motivo)) {
    throw new Error(
      `motivo debe ser uno de: ${MOTIVOS_VALIDOS.join(", ")} (RF-06)`,
    );
  }

  const lotes = await inventarioRepository.obtenerLotesConStock(articuloId);
  const movimientosFEFO = descontarPorFEFO(lotes, cantidad);

  const movimientoId = await inventarioRepository.registrarMerma({
    articuloId,
    cantidadTotal: cantidad,
    usuarioId,
    motivo,
    movimientosFEFO,
  });

  return { movimientoId, detalle: movimientosFEFO };
}

module.exports = { registrarMerma };
