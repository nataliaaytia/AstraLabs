const pool = require("../db/pool");

/**
 * Capa de Repositorios — donantes (RF-14).
 */

async function crearDonante({ nombre, tipo, contacto, telefono, email }) {
  const { rows } = await pool.query(
    `INSERT INTO donantes (nombre, tipo, contacto, telefono, email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, tipo, contacto, telefono, email, created_at`,
    [nombre, tipo, contacto || null, telefono || null, email || null],
  );
  return rows[0];
}

async function listarDonantes({ q, tipo } = {}) {
  const cond = [];
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    cond.push(
      `(nombre ILIKE $${params.length} OR contacto ILIKE $${params.length})`,
    );
  }
  if (tipo) {
    params.push(tipo);
    cond.push(`tipo = $${params.length}`);
  }
  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT id, nombre, tipo, contacto, telefono, email, created_at
     FROM donantes ${where}
     ORDER BY nombre`,
    params,
  );
  return rows;
}

module.exports = { crearDonante, listarDonantes };
