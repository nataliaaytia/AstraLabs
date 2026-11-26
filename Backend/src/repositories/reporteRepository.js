const pool = require("../db/pool");

/**
 * Capa de Repositorios — reportes (RF-21).
 */

/**
 * Artículos con stock por debajo de su mínimo, ordenados por el déficit
 * más grande primero (los más urgentes de reponer).
 */
async function obtenerNecesidadesCriticas({ limite } = {}) {
  const params = [];
  let limiteSql = "";

  if (limite) {
    params.push(limite);
    limiteSql = `LIMIT $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT articulo_id, articulo, stock_minimo, stock_actual,
            (stock_minimo - stock_actual) AS deficit
     FROM vw_stock_articulo
     WHERE stock_minimo > 0 AND stock_actual < stock_minimo
     ORDER BY deficit DESC
     ${limiteSql}`,
    params,
  );
  return rows;
}

module.exports = { obtenerNecesidadesCriticas };
