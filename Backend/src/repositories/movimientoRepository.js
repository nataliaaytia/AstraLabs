const pool = require("../db/pool");

/**
 * Capa de Repositorios — historial de movimientos (kardex) para reportes.
 * Las fechas se interpretan en hora de Bolivia para que un movimiento de la
 * noche no caiga en el día siguiente por culpa de UTC.
 */
const ZONA = "America/La_Paz";

async function listarMovimientos({ desde, hasta, tipo, limite }) {
  const cond = [];
  const params = [];
  if (desde) {
    params.push(desde);
    cond.push(`(m.fecha AT TIME ZONE '${ZONA}')::date >= $${params.length}`);
  }
  if (hasta) {
    params.push(hasta);
    cond.push(`(m.fecha AT TIME ZONE '${ZONA}')::date <= $${params.length}`);
  }
  if (tipo) {
    params.push(tipo);
    cond.push(`m.tipo = $${params.length}`);
  }
  params.push(limite);

  const { rows } = await pool.query(
    `SELECT m.id, m.tipo,
            to_char(m.fecha AT TIME ZONE '${ZONA}', 'YYYY-MM-DD') AS fecha,
            a.id AS articulo_id, a.nombre AS articulo, a.unidad_medida,
            m.cantidad_total AS cantidad,
            m.destino, m.motivo, m.observaciones,
            d.nombre AS donante, u.nombre AS registrado_por
       FROM movimientos m
       JOIN articulos a ON a.id = m.articulo_id
       JOIN usuarios u ON u.id = m.usuario_id
       LEFT JOIN donantes d ON d.id = m.donante_id
      ${cond.length ? `WHERE ${cond.join(" AND ")}` : ""}
      ORDER BY m.fecha DESC, m.id DESC
      LIMIT $${params.length}`,
    params,
  );
  return rows;
}

module.exports = { listarMovimientos };
