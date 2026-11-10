const pool = require("../db/pool");

/**
 * Capa de Repositorios — plan de comidas (RF-17).
 */

async function crearPlan({ fecha, tipoComida, menuId, comensales, usuarioId }) {
  const { rows } = await pool.query(
    `INSERT INTO planes_comida (fecha, tipo_comida, menu_id, comensales, usuario_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, fecha, tipo_comida, menu_id, comensales, estado`,
    [fecha, tipoComida, menuId, comensales, usuarioId],
  );
  return rows[0];
}

async function listarPlanes({ fecha } = {}) {
  const params = [];
  let where = "";

  if (fecha) {
    params.push(fecha);
    where = `WHERE p.fecha = $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT p.id, p.fecha, p.tipo_comida, p.comensales, p.estado,
            m.id AS menu_id, m.nombre AS menu
     FROM planes_comida p
     JOIN menus m ON m.id = p.menu_id
     ${where}
     ORDER BY p.fecha, p.tipo_comida`,
    params,
  );
  return rows;
}

module.exports = { crearPlan, listarPlanes };
