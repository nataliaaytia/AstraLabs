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

// ---------- Panel de alertas persistidas (RF-12) ----------

const HOY = "(now() AT TIME ZONE 'America/La_Paz')::date";

/**
 * Pone la tabla `alertas` al día con la situación real del inventario:
 *  - crea una alerta pendiente por cada lote por vencer/vencido y cada artículo en su
 *    stock mínimo que aún no tenga una;
 *  - cierra automáticamente (atendida, sin usuario) las pendientes cuya condición ya no se cumple.
 * Una alerta que la Administradora marcó como atendida NO se vuelve a crear mientras
 * siga la misma situación (vencimiento: nunca para ese lote; stock: hasta que llegue
 * una nueva entrada del artículo).
 * `articuloIds` (opcional) limita la sincronización a esos artículos.
 */
async function sincronizarAlertas({ diasVencimiento, articuloIds = null }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('sincronizar_alertas'))",
    );
    const p = [diasVencimiento, articuloIds];
    const pStock = [articuloIds];

    const venceYa = `l.cantidad_disponible > 0 AND l.fecha_vencimiento IS NOT NULL AND a.activo = TRUE
                     AND l.fecha_vencimiento <= ${HOY} + $1::int`;

    const resVenc = await client.query(
      `UPDATE alertas al SET estado = 'atendida', fecha_atendida = now()
        WHERE al.estado = 'pendiente' AND al.tipo = 'vencimiento'
          AND ($2::int[] IS NULL OR al.articulo_id = ANY($2::int[]))
          AND NOT EXISTS (SELECT 1 FROM lotes l JOIN articulos a ON a.id = l.articulo_id
                           WHERE l.id = al.lote_id AND ${venceYa})`,
      p,
    );
    const resStock = await client.query(
      `UPDATE alertas al SET estado = 'atendida', fecha_atendida = now()
        WHERE al.estado = 'pendiente' AND al.tipo = 'stock_minimo'
          AND ($1::int[] IS NULL OR al.articulo_id = ANY($1::int[]))
          AND NOT EXISTS (
                SELECT 1 FROM articulos a
                 WHERE a.id = al.articulo_id AND a.activo = TRUE AND a.stock_minimo > 0
                   AND COALESCE((SELECT SUM(cantidad_disponible) FROM lotes WHERE articulo_id = a.id), 0) <= a.stock_minimo)`,
      pStock,
    );

    const nuevasVenc = await client.query(
      `INSERT INTO alertas (tipo, articulo_id, lote_id)
       SELECT 'vencimiento', l.articulo_id, l.id
         FROM lotes l JOIN articulos a ON a.id = l.articulo_id
        WHERE ${venceYa}
          AND ($2::int[] IS NULL OR a.id = ANY($2::int[]))
          AND NOT EXISTS (SELECT 1 FROM alertas x
                           WHERE x.tipo = 'vencimiento' AND x.lote_id = l.id
                             AND (x.estado = 'pendiente' OR x.usuario_atiende_id IS NOT NULL))`,
      p,
    );
    const nuevasStock = await client.query(
      `INSERT INTO alertas (tipo, articulo_id)
       SELECT 'stock_minimo', a.id
         FROM articulos a LEFT JOIN lotes l ON l.articulo_id = a.id
        WHERE a.activo = TRUE AND a.stock_minimo > 0
          AND ($1::int[] IS NULL OR a.id = ANY($1::int[]))
          AND NOT EXISTS (SELECT 1 FROM alertas x
                           WHERE x.tipo = 'stock_minimo' AND x.articulo_id = a.id AND x.estado = 'pendiente')
          AND NOT EXISTS (SELECT 1 FROM alertas x
                           WHERE x.tipo = 'stock_minimo' AND x.articulo_id = a.id
                             AND x.usuario_atiende_id IS NOT NULL
                             AND x.fecha_atendida >= COALESCE(
                                   (SELECT MAX(m.fecha) FROM movimientos m
                                     WHERE m.articulo_id = a.id AND m.tipo = 'entrada'), '-infinity'))
        GROUP BY a.id, a.stock_minimo
       HAVING COALESCE(SUM(l.cantidad_disponible), 0) <= a.stock_minimo`,
      pStock,
    );

    await client.query("COMMIT");
    return {
      creadas: nuevasVenc.rowCount + nuevasStock.rowCount,
      resueltas: resVenc.rowCount + resStock.rowCount,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function condicionesPanel({ tipo, q }) {
  const params = [];
  const cond = [];
  if (tipo) {
    params.push(tipo);
    cond.push(`al.tipo = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    cond.push(`a.nombre ILIKE $${params.length}`);
  }
  return { params, cond };
}

async function listarAlertas({ estado, tipo, q, limite }) {
  const { params, cond } = condicionesPanel({ tipo, q });
  if (estado) {
    params.push(estado);
    cond.push(`al.estado = $${params.length}`);
  }
  params.push(limite);
  const { rows } = await pool.query(
    `SELECT al.id, al.tipo, al.estado, al.fecha_generada, al.fecha_atendida,
            u.nombre AS atendida_por,
            a.id AS articulo_id, a.nombre AS articulo, c.nombre AS categoria,
            a.unidad_medida, a.stock_minimo,
            COALESCE((SELECT SUM(cantidad_disponible) FROM lotes WHERE articulo_id = a.id), 0) AS stock_actual,
            al.lote_id, l.numero_lote, l.fecha_vencimiento::text AS fecha_vencimiento,
            (l.fecha_vencimiento - ${HOY}) AS dias_restantes,
            l.cantidad_disponible AS cantidad_lote
       FROM alertas al
       JOIN articulos a ON a.id = al.articulo_id
       JOIN categorias c ON c.id = a.categoria_id
       LEFT JOIN lotes l ON l.id = al.lote_id
       LEFT JOIN usuarios u ON u.id = al.usuario_atiende_id
      ${cond.length ? `WHERE ${cond.join(" AND ")}` : ""}
      ORDER BY (al.estado = 'pendiente') DESC, al.fecha_generada DESC, al.id DESC
      LIMIT $${params.length}`,
    params,
  );
  return rows;
}

/** Totales por estado (respetando tipo y búsqueda, no el límite). */
async function contarAlertas({ tipo, q }) {
  const { params, cond } = condicionesPanel({ tipo, q });
  const { rows } = await pool.query(
    `SELECT al.estado, COUNT(*)::int AS n
       FROM alertas al JOIN articulos a ON a.id = al.articulo_id
      ${cond.length ? `WHERE ${cond.join(" AND ")}` : ""}
      GROUP BY al.estado`,
    params,
  );
  return Object.fromEntries(rows.map((r) => [r.estado, r.n]));
}

/** Marca una alerta pendiente como atendida. Devuelve null si no estaba pendiente. */
async function atenderAlerta(id, usuarioId) {
  const { rows } = await pool.query(
    `UPDATE alertas SET estado = 'atendida', fecha_atendida = now(), usuario_atiende_id = $2
      WHERE id = $1 AND estado = 'pendiente'
      RETURNING id`,
    [id, usuarioId],
  );
  return rows[0] || null;
}

async function existeAlerta(id) {
  const { rows } = await pool.query(`SELECT 1 FROM alertas WHERE id = $1`, [
    id,
  ]);
  return rows.length > 0;
}

module.exports = {
  obtenerUmbralVencimiento,
  guardarUmbralVencimiento,
  listarLotesPorVencer,
  listarArticulosEnMinimo,
  sincronizarAlertas,
  listarAlertas,
  contarAlertas,
  atenderAlerta,
  existeAlerta,
};
