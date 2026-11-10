const { descontarPorFEFO } = require("../services/fefoService");
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

async function obtenerPlanParaConfirmar(client, planId) {
  const { rows } = await client.query(
    `SELECT id, fecha, tipo_comida, menu_id, comensales, estado
     FROM planes_comida
     WHERE id = $1
     FOR UPDATE`,
    [planId],
  );
  return rows[0] || null;
}

async function obtenerIngredientesMenu(client, menuId) {
  const { rows } = await client.query(
    `SELECT articulo_id, cantidad_por_porcion FROM menu_ingredientes WHERE menu_id = $1`,
    [menuId],
  );
  return rows;
}

/**
 * Confirma la preparación de un plan: descuenta por FEFO el stock de cada
 * ingrediente del menú (cantidad_por_porcion * comensales), registrando un
 * movimiento de salida por artículo, todo en una sola transacción — si
 * falta stock de cualquier ingrediente, no se descuenta nada (RF-19).
 */
async function confirmarPlanConDescuento({ planId, usuarioId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const plan = await obtenerPlanParaConfirmar(client, planId);
    if (!plan) {
      throw new Error("El plan de comidas no existe");
    }
    if (plan.estado !== "planificado") {
      throw new Error(`El plan ya fue ${plan.estado}`);
    }

    const ingredientes = await obtenerIngredientesMenu(client, plan.menu_id);
    if (ingredientes.length === 0) {
      throw new Error("El menú de este plan no tiene ingredientes registrados");
    }

    let ultimoMovimientoId = null;
    const destino = `Plan de comidas #${planId} (${plan.tipo_comida})`;

    for (const ing of ingredientes) {
      const cantidadNecesaria =
        Number(ing.cantidad_por_porcion) * Number(plan.comensales);

      const { rows: lotes } = await client.query(
        `SELECT id, cantidad_disponible, fecha_vencimiento
         FROM lotes
         WHERE articulo_id = $1 AND cantidad_disponible > 0
         ORDER BY fecha_vencimiento NULLS LAST
         FOR UPDATE`,
        [ing.articulo_id],
      );

      let movimientosFEFO;
      try {
        movimientosFEFO = descontarPorFEFO(lotes, cantidadNecesaria);
      } catch (err) {
        throw new Error(`Artículo ${ing.articulo_id}: ${err.message}`);
      }

      const { rows: movRows } = await client.query(
        `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id, destino)
         VALUES ('salida', $1, $2, $3, $4)
         RETURNING id`,
        [ing.articulo_id, cantidadNecesaria, usuarioId, destino],
      );
      ultimoMovimientoId = movRows[0].id;

      for (const { lote_id, cantidad_descontada } of movimientosFEFO) {
        await client.query(
          `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad) VALUES ($1, $2, $3)`,
          [ultimoMovimientoId, lote_id, cantidad_descontada],
        );
      }
    }

    const { rows: planActualizado } = await client.query(
      `UPDATE planes_comida SET estado = 'confirmado', movimiento_salida_id = $1
       WHERE id = $2
       RETURNING id, fecha, tipo_comida, comensales, estado, movimiento_salida_id`,
      [ultimoMovimientoId, planId],
    );

    await client.query("COMMIT");
    return planActualizado[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { crearPlan, listarPlanes, confirmarPlanConDescuento };
