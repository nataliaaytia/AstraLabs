/**
 * Gestor de Inventario y FEFO (First Expired, First Out)
 *
 * Unico componente autorizado a modificar el stock (ver ADR-01).
 * Dado un conjunto de lotes de un articulo, descuenta una cantidad
 * solicitada priorizando siempre el lote con fecha de vencimiento
 * mas proxima, repartiendo entre varios lotes si es necesario.
 *
 * Cubre: RF-05 (stock se actualiza automaticamente),
 *        RF-20 (prioriza insumos proximos a vencer).
 */

/**
 * @param {Array} lotes - [{ id, cantidad_disponible, fecha_vencimiento }]
 * @param {number} cantidadSolicitada
 * @returns {Array} movimientos - [{ lote_id, cantidad_descontada }]
 * @throws {Error} si el stock total disponible es insuficiente
 */
function descontarPorFEFO(lotes, cantidadSolicitada) {
  if (cantidadSolicitada <= 0) {
    throw new Error("La cantidad solicitada debe ser mayor a cero");
  }

  const stockTotal = lotes.reduce((acc, l) => acc + l.cantidad_disponible, 0);
  if (stockTotal < cantidadSolicitada) {
    throw new Error(
      `Stock insuficiente: disponible ${stockTotal}, solicitado ${cantidadSolicitada}`
    );
  }

  // Lotes sin fecha de vencimiento (no perecederos) se consumen al final
  const ordenados = [...lotes].sort((a, b) => {
    if (!a.fecha_vencimiento) return 1;
    if (!b.fecha_vencimiento) return -1;
    return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento);
  });

  let restante = cantidadSolicitada;
  const movimientos = [];

  for (const lote of ordenados) {
    if (restante <= 0) break;
    if (lote.cantidad_disponible <= 0) continue;

    const aDescontar = Math.min(lote.cantidad_disponible, restante);
    movimientos.push({ lote_id: lote.id, cantidad_descontada: aDescontar });
    restante -= aDescontar;
  }

  return movimientos;
}

module.exports = { descontarPorFEFO };
