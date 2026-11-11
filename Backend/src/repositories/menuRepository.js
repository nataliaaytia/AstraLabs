const pool = require("../db/pool");

async function listarMenus() {
  const { rows } = await pool.query(
    `SELECT m.id, m.nombre, m.descripcion,
            COALESCE(json_agg(json_build_object('articuloId', mi.articulo_id,
              'cantidadPorPorcion', mi.cantidad_por_porcion)
              ORDER BY mi.id) FILTER (WHERE mi.id IS NOT NULL), '[]'::json) AS ingredientes
     FROM menus m LEFT JOIN menu_ingredientes mi ON mi.menu_id = m.id
     WHERE m.activo = TRUE GROUP BY m.id ORDER BY m.nombre`,
  );
  return rows;
}

/**
 * Crea un menú con sus ingredientes en una sola transacción (RF-16).
 * @param {Array<{articuloId:number, cantidadPorPorcion:number}>} ingredientes
 */
async function crearMenu({ nombre, descripcion, ingredientes }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: menuRows } = await client.query(
      `INSERT INTO menus (nombre, descripcion) VALUES ($1, $2) RETURNING id, nombre, descripcion`,
      [nombre, descripcion || null],
    );
    const menu = menuRows[0];

    for (const ing of ingredientes) {
      await client.query(
        `INSERT INTO menu_ingredientes (menu_id, articulo_id, cantidad_por_porcion) VALUES ($1, $2, $3)`,
        [menu.id, ing.articuloId, ing.cantidadPorPorcion],
      );
    }

    await client.query("COMMIT");
    return menu;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function obtenerMenuConIngredientes(menuId) {
  const menu = await pool.query(
    `SELECT id, nombre, descripcion FROM menus WHERE id = $1`,
    [menuId],
  );
  if (!menu.rows[0]) return null;

  const ingredientes = await pool.query(
    `SELECT mi.articulo_id, a.nombre AS articulo, mi.cantidad_por_porcion
     FROM menu_ingredientes mi
     JOIN articulos a ON a.id = mi.articulo_id
     WHERE mi.menu_id = $1
     ORDER BY a.nombre`,
    [menuId],
  );

  return { ...menu.rows[0], ingredientes: ingredientes.rows };
}

module.exports = { listarMenus, crearMenu, obtenerMenuConIngredientes };
