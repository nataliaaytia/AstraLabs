const pool = require("../db/pool");

async function listarMenus() {
  const { rows } = await pool.query(
    `SELECT id, nombre, descripcion FROM menus WHERE activo = TRUE ORDER BY nombre`,
  );
  return rows;
}

module.exports = { listarMenus };
