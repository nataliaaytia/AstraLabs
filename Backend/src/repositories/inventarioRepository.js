const pool = require("../db/pool");

/**
 * Capa de Repositorios (ver Modelo C4 - Nivel 3).
 * Único punto de acceso a las tablas de inventario. Nada fuera de aquí
 * ejecuta SQL directo contra lotes/movimientos.
 */

/**
 * Lotes con stock disponible de un artículo, los únicos candidatos para
 * que el Gestor de Inventario y FEFO decida de dónde descontar (RF-20).
 */
async function obtenerLotesConStock(articuloId) {
  const { rows } = await pool.query(
    `SELECT id, cantidad_disponible, fecha_vencimiento
     FROM lotes
     WHERE articulo_id = $1 AND cantidad_disponible > 0
     ORDER BY fecha_vencimiento NULLS LAST`,
    [articuloId],
  );
  return rows;
}

/**
 * Registra una salida de forma atómica: el movimiento cabecera y el
 * detalle por lote (que dispara el trigger de actualización de stock,
 * ver schema.sql) quedan en una sola transacción.
 *
 * @param {number} articuloId
 * @param {number} cantidadTotal
 * @param {number} usuarioId
 * @param {string} destino
 * @param {Array<{lote_id:number, cantidad_descontada:number}>} movimientosFEFO
 * @returns {Promise<number>} id del movimiento creado
 */
async function registrarSalida({
  articuloId,
  cantidadTotal,
  usuarioId,
  destino,
  movimientosFEFO,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id, destino)
       VALUES ('salida', $1, $2, $3, $4)
       RETURNING id`,
      [articuloId, cantidadTotal, usuarioId, destino],
    );
    const movimientoId = rows[0].id;

    for (const m of movimientosFEFO) {
      await client.query(
        `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad)
         VALUES ($1, $2, $3)`,
        [movimientoId, m.lote_id, m.cantidad_descontada],
      );
    }

    await client.query("COMMIT");
    return movimientoId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function registrarExcedente({
  articuloId,
  cantidadTotal,
  usuarioId,
  destino,
  movimientosFEFO,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: movRows } = await client.query(
      `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id, destino)
       VALUES ('excedente', $1, $2, $3, $4)
       RETURNING id`,
      [articuloId, cantidadTotal, usuarioId, destino],
    );
    const movimientoId = movRows[0].id;

    for (const { loteId, cantidad } of movimientosFEFO) {
      await client.query(
        `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad) VALUES ($1, $2, $3)`,
        [movimientoId, loteId, cantidad],
      );
    }

    await client.query("COMMIT");
    return { movimientoId, articuloId, cantidadTotal };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Registra una merma de forma atómica, igual que una salida pero con
 * motivo obligatorio en vez de destino (RF-06).
 *
 * @param {number} articuloId
 * @param {number} cantidadTotal
 * @param {number} usuarioId
 * @param {string} motivo - 'vencimiento' | 'deterioro' | 'perdida'
 * @param {Array<{lote_id:number, cantidad_descontada:number}>} movimientosFEFO
 * @returns {Promise<number>} id del movimiento creado
 */
async function registrarMerma({
  articuloId,
  cantidadTotal,
  usuarioId,
  motivo,
  movimientosFEFO,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id, motivo)
       VALUES ('merma', $1, $2, $3, $4)
       RETURNING id`,
      [articuloId, cantidadTotal, usuarioId, motivo],
    );
    const movimientoId = rows[0].id;

    for (const m of movimientosFEFO) {
      await client.query(
        `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad)
         VALUES ($1, $2, $3)`,
        [movimientoId, m.lote_id, m.cantidad_descontada],
      );
    }

    await client.query("COMMIT");
    return movimientoId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Consulta el stock actual de un artículo (RF-05).
 * Lee directo de vw_stock_articulo: la vista ya suma los lotes,
 * así que lo que devuelve es siempre el valor recalculado, nunca
 * un contador que alguien tuvo que actualizar a mano.
 */
async function obtenerStockArticulo(articuloId) {
  const { rows } = await pool.query(
    `SELECT articulo_id, articulo, stock_minimo, stock_actual
     FROM vw_stock_articulo
     WHERE articulo_id = $1`,
    [articuloId],
  );
  return rows[0] || null;
}

module.exports = {
  obtenerLotesConStock,
  registrarSalida,
  obtenerStockArticulo,
  registrarMerma,
  registrarExcedente,
};
