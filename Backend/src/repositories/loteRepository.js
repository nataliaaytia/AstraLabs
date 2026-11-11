const pool = require("../db/pool");

async function listarLotes() {
  const { rows } = await pool.query(`
    SELECT id, articulo_id AS "articuloId",
           COALESCE(numero_lote, 'SIN-ASIGNAR') AS codigo,
           fecha_vencimiento::text AS "fechaVencimiento",
           cantidad_disponible AS "cantidadDisponible"
    FROM lotes ORDER BY fecha_vencimiento NULLS LAST, id`);
  return rows;
}

// Se redistribuye stock existente, sin registrar una nueva entrada.
async function asignarLote({ articuloId, codigo, cantidad, fechaVencimiento }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: sinAsignar } = await client.query(`
      SELECT id, cantidad_disponible FROM lotes
      WHERE articulo_id = $1 AND numero_lote IS NULL AND fecha_vencimiento IS NULL
        AND cantidad_disponible > 0
      ORDER BY id FOR UPDATE`, [articuloId]);
    const stock = sinAsignar.reduce((s, l) => s + Number(l.cantidad_disponible), 0);
    if (stock + 1e-9 < cantidad) throw new Error('No hay suficiente stock sin asignar para crear el lote');
    const { rows: existentes } = await client.query(`
      SELECT id FROM lotes WHERE articulo_id = $1 AND UPPER(numero_lote) = $2 LIMIT 1`,
      [articuloId, codigo]);
    if (existentes.length) throw new Error('Ya existe ese código de lote para el artículo');
    let restante = cantidad;
    for (const lote of sinAsignar) {
      if (restante <= 0) break;
      const descontar = Math.min(restante, Number(lote.cantidad_disponible));
      await client.query('UPDATE lotes SET cantidad_disponible = cantidad_disponible - $1 WHERE id = $2',
        [descontar, lote.id]);
      restante = Number((restante - descontar).toFixed(2));
    }
    const { rows } = await client.query(`
      INSERT INTO lotes (articulo_id, numero_lote, fecha_vencimiento, cantidad_inicial, cantidad_disponible)
      VALUES ($1, $2, $3, $4, $4)
      RETURNING id, articulo_id AS "articuloId", numero_lote AS codigo,
                fecha_vencimiento::text AS "fechaVencimiento", cantidad_disponible AS "cantidadDisponible"`,
      [articuloId, codigo, fechaVencimiento, cantidad]);
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
module.exports = { listarLotes, asignarLote };
