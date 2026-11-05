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

    for (const { lote_id, cantidad_descontada } of movimientosFEFO) {
      await client.query(
        `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad) VALUES ($1, $2, $3)`,
        [movimientoId, lote_id, cantidad_descontada],
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

/**
 * Registra una entrada de donación: crea el lote y el movimiento cabecera
 * en una sola transacción. El trigger de schema.sql es quien suma
 * cantidad_disponible al insertar en movimiento_lotes (RF-02).
 *
 * @param {number} articuloId
 * @param {number} cantidad
 * @param {number} usuarioId
 * @param {number|null} donanteId
 * @param {string|null} fecha - fecha de ingreso (YYYY-MM-DD); si no se manda, usa CURRENT_DATE
 * @param {string|null} fechaVencimiento
 * @param {string|null} numeroLote
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: loteRows } = await client.query(
      `INSERT INTO lotes (articulo_id, numero_lote, fecha_vencimiento, donante_id, cantidad_inicial, fecha_ingreso)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE))
       RETURNING id`,
      [
        articuloId,
        numeroLote || null,
        fechaVencimiento || null,
        donanteId || null,
        cantidad,
        fecha || null,
      ],
    );
    const loteId = loteRows[0].id;

    const { rows: movRows } = await client.query(
      `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id, donante_id)
       VALUES ('entrada', $1, $2, $3, $4)
       RETURNING id`,
      [articuloId, cantidad, usuarioId, donanteId || null],
    );
    const movimientoId = movRows[0].id;

    await client.query(
      `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad) VALUES ($1, $2, $3)`,
      [movimientoId, loteId, cantidad],
    );

    await client.query("COMMIT");
    return { movimientoId, loteId, articuloId, cantidadTotal: cantidad };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  obtenerLotesConStock,
  registrarSalida,
  obtenerStockArticulo,
  registrarMerma,
  registrarExcedente,
  registrarEntrada,
};
