const inventarioRepository = require("../repositories/inventarioRepository");

/**
 * Servicio de Entradas (RF-02): registra la entrada de una donación,
 * creando un lote nuevo y actualizando el stock.
 */
async function registrarEntrada({
  articuloId,
  cantidad,
  usuarioId,
  donanteId,
  fecha,
  fechaVencimiento,
  numeroLote,
}) {
  if (!articuloId) {
    throw new Error("articuloId es obligatorio");
  }
  if (!usuarioId) {
    throw new Error("usuarioId es obligatorio");
  }
  if (!Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0) {
    throw new Error("La cantidad debe ser mayor a cero");
  }

  return inventarioRepository.registrarEntrada({
    articuloId,
    cantidad: Number(cantidad),
    usuarioId,
    donanteId: donanteId || null,
    fecha: fecha || null,
    fechaVencimiento: fechaVencimiento || null,
    numeroLote: numeroLote || null,
  });
}

module.exports = { registrarEntrada };
