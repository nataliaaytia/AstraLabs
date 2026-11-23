const pool = require("../db/pool");

/**
 * Capa de Repositorios — alertas (RF-10).
 * Las fechas se calculan con la fecha de La Paz (el servidor de la BD está en UTC).
 */

const CLAVE_UMBRAL_VENCIMIENTO = "dias_anticipacion_vencimiento";

async function obtenerUmbralVencimiento() {
  const { rows } = await pool.query(
    `SELECT valor FROM configuracion WHERE clave = $1`,
    [CLAVE_UMBRAL_VENCIMIENTO],
  );
  return rows[0] ? rows[0].valor : null;
}

async function guardarUmbralVencimiento(dias) {
  await pool.query(
    `INSERT INTO configuracion (clave, valor, descripcion)
     VALUES ($1, $2, 'Días de anticipación para alertar productos próximos a vencer (RF-10)')
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
    [CLAVE_UMBRAL_VENCIMIENTO, String(dias)],
  );
}

/**
 * Lotes con stock que ya vencieron o vencen dentro de `dias` días.
 * dias_restantes: negativo = ya vencido, 0 = vence hoy.
 */
async function listarLotesPorVencer(dias) {
  const { rows } = await pool.query(
    `SELECT l.id AS lote_id, l.numero_lote, l.fecha_vencimiento::text AS fecha_vencimiento,
            (l.fecha_vencimiento - (now() AT TIME ZONE 'America/La_Paz')::date) AS dias_restantes,
            l.cantidad_disponible, a.id AS articulo_id, a.nombre AS articulo,
            a.unidad_medida, c.nombre AS categoria
       FROM lotes l
       JOIN articulos a ON a.id = l.articulo_id
       JOIN categorias c ON c.id = a.categoria_id
      WHERE l.cantidad_disponible > 0
        AND l.fecha_vencimiento IS NOT NULL
        AND a.activo = TRUE
        AND l.fecha_vencimiento <= (now() AT TIME ZONE 'America/La_Paz')::date + $1::int
      ORDER BY l.fecha_vencimiento, a.nombre, l.id`,
    [dias],
  );
  return rows;
}

/**
 * Artículos activos con stock mínimo definido (> 0) cuyo stock actual es
 * menor o igual a ese mínimo (RF-11).
 */
async function listarArticulosEnMinimo() {
  const { rows } = await pool.query(
    `SELECT a.id AS articulo_id, a.nombre AS articulo, c.nombre AS categoria,
            a.unidad_medida, a.stock_minimo,
            COALESCE(SUM(l.cantidad_disponible), 0) AS stock_actual
       FROM articulos a
       JOIN categorias c ON c.id = a.categoria_id
       LEFT JOIN lotes l ON l.articulo_id = a.id
      WHERE a.activo = TRUE AND a.stock_minimo > 0
      GROUP BY a.id, a.nombre, c.nombre, a.unidad_medida, a.stock_minimo
     HAVING COALESCE(SUM(l.cantidad_disponible), 0) <= a.stock_minimo
      ORDER BY (COALESCE(SUM(l.cantidad_disponible), 0) / a.stock_minimo), a.nombre`,
  );
  return rows;
}

module.exports = {
  obtenerUmbralVencimiento,
  guardarUmbralVencimiento,
  listarLotesPorVencer,
  listarArticulosEnMinimo,
};
