const pool = require("../db/pool");

/**
 * Capa de Repositorios — usuarios y roles (ver Modelo C4 - Nivel 3).
 */

async function obtenerPorEmail(email) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.email, u.password_hash, r.nombre AS rol
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE u.email = $1 AND u.activo = TRUE`,
    [email],
  );
  return rows[0] || null;
}

async function listarUsuarios({ q, rol } = {}) {
  const params = [];
  let where = "WHERE u.activo = TRUE";
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (u.nombre ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }
  if (rol) {
    params.push(rol);
    where += ` AND r.nombre = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.email, r.nombre AS rol
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     ${where}
     ORDER BY u.nombre`,
    params,
  );
  return rows;
}

async function actualizarRol(usuarioId, nuevoRolNombre) {
  const rol = await pool.query(`SELECT id FROM roles WHERE nombre = $1`, [
    nuevoRolNombre,
  ]);
  if (!rol.rows[0]) {
    throw new Error(`El rol '${nuevoRolNombre}' no existe`);
  }

  const { rows } = await pool.query(
    `UPDATE usuarios SET rol_id = $1 WHERE id = $2
     RETURNING id, nombre, email`,
    [rol.rows[0].id, usuarioId],
  );

  if (!rows[0]) {
    throw new Error("Usuario no encontrado");
  }

  return rows[0];
}

module.exports = { obtenerPorEmail, listarUsuarios, actualizarRol };
