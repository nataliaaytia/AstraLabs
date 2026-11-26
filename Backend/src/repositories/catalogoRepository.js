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

async function listarArticulos({ categoriaId, q, bajoMinimo } = {}) {
  const params = [];
  let where = "WHERE a.activo = TRUE";

  if (categoriaId) {
    params.push(categoriaId);
    where += ` AND a.categoria_id = $${params.length}`;
  }
  if (q) {
    params.push(`%${q}%`);
    where += ` AND a.nombre ILIKE $${params.length}`;
  }
  const having = bajoMinimo
    ? "HAVING COALESCE(SUM(l.cantidad_disponible), 0) < a.stock_minimo"
    : "";

  const { rows } = await pool.query(
    `SELECT a.id, a.nombre, a.categoria_id, c.nombre AS categoria,
            a.unidad_medida, a.es_perecedero, a.stock_minimo, a.created_at,
            COALESCE(SUM(l.cantidad_disponible), 0) AS stock_actual
     FROM articulos a
     JOIN categorias c ON c.id = a.categoria_id
     LEFT JOIN lotes l ON l.articulo_id = a.id
     ${where}
     GROUP BY a.id, a.nombre, a.categoria_id, c.nombre, a.unidad_medida, a.es_perecedero, a.stock_minimo, a.created_at
     ${having}
     ORDER BY c.nombre, a.nombre`,
    params,
  );
  return rows;
}

async function crearArticulo({
  nombre,
  categoriaId,
  unidadMedida,
  esPerecedero,
  stockMinimo,
}) {
  const { rows } = await pool.query(
    `INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo, created_at`,
    [nombre, categoriaId, unidadMedida, esPerecedero, stockMinimo],
  );
  return rows[0];
}

async function actualizarArticulo(id, campos) {
  const columnas = Object.keys(campos);
  const sets = columnas.map((c, i) => `${c} = $${i + 2}`).join(", ");
  const { rows } = await pool.query(
    `UPDATE articulos SET ${sets}
      WHERE id = $1 AND activo = TRUE
      RETURNING id, nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo, created_at`,
    [id, ...columnas.map((c) => campos[c])],
  );
  return rows[0];
}

module.exports = {
  listarCategorias,
  listarArticulos,
  crearArticulo,
  actualizarArticulo,
};
