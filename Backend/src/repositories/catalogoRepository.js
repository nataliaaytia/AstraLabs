const pool = require("../db/pool");

/**
 * Capa de Repositorios — catálogo de artículos (RF-01, RF-07).
 */

async function listarCategorias() {
  const { rows } = await pool.query(
    `SELECT id, nombre FROM categorias ORDER BY nombre`,
  );
  return rows;
}

async function listarArticulos({ categoriaId } = {}) {
  const params = [];
  let where = "WHERE a.activo = TRUE";

  if (categoriaId) {
    params.push(categoriaId);
    where += ` AND a.categoria_id = $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT a.id, a.nombre, a.categoria_id, c.nombre AS categoria,
            a.unidad_medida, a.es_perecedero, a.stock_minimo,
            COALESCE(SUM(l.cantidad_disponible), 0) AS stock_actual
     FROM articulos a
     JOIN categorias c ON c.id = a.categoria_id
     LEFT JOIN lotes l ON l.articulo_id = a.id
     ${where}
     GROUP BY a.id, a.nombre, a.categoria_id, c.nombre, a.unidad_medida, a.es_perecedero, a.stock_minimo
     ORDER BY c.nombre, a.nombre`,
    params,
  );
  return rows;
}

module.exports = { listarCategorias, listarArticulos };
