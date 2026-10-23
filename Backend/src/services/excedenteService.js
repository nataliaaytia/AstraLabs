const inventarioRepository = require("../repositories/inventarioRepository");
const { descontarPorFEFO } = require("./fefoService");

/**
 * Servicio de Excedentes (RF-09): marca un excedente de inventario y su
 * destino (ej. donación a otra institución, reasignación), descontando
 * stock por FEFO igual que una salida o una merma.
 */
async function registrarExcedente({
  articuloId,
  cantidad,
  usuarioId,
  destino,
}) {
  if (!destino) {
    throw new Error(
      "destino es obligatorio para registrar un excedente (RF-09)",
    );
  }

  const lotes = await inventarioRepository.obtenerLotesConStock(articuloId);
  const movimientosFEFO = descontarPorFEFO(lotes, cantidad);

  return inventarioRepository.registrarExcedente({
    articuloId,
    cantidadTotal: cantidad,
    usuarioId,
    destino,
    movimientosFEFO,
  });
}

module.exports = { registrarExcedente };
