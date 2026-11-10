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

async function listarDonantes() {
  const { rows } = await pool.query(
    `SELECT id, nombre, tipo, contacto, telefono, email, created_at
     FROM donantes
     ORDER BY nombre`,
  );
  return rows;
}

module.exports = { crearDonante, listarDonantes };
