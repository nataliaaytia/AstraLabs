const pool = require("../db/pool");
const mermaService = require("./mermaService");
const inventarioRepository = require("../repositories/inventarioRepository");

const NOMBRE_ARTICULO_TEST = "Articulo Test HU-06";
const EMAIL_USUARIO_TEST = "test-hu06@astralabs.test";

/**
 * Prueba de integración (RF-06): sin mocks. Verifica dos cosas reales
 * contra Neon:
 *   1. Que registrar una merma descuenta el stock solo (trigger de BD).
 *   2. Que la BD rechaza un motivo fuera de la lista permitida, probando
 *      que el CHECK agregado a movimientos.motivo quedó activo.
 */
describe("HU-06 - registrar merma con motivo (integración)", () => {
  let articuloId;
  let usuarioId;

  beforeAll(async () => {
    await pool.query("SELECT 1");

    // Limpieza preventiva, por si una corrida anterior quedó a medias
    await pool.query(`
      DELETE FROM movimiento_lotes WHERE lote_id IN (
        SELECT l.id FROM lotes l
        JOIN articulos a ON a.id = l.articulo_id
        WHERE a.nombre = '${NOMBRE_ARTICULO_TEST}'
      )
    `);
    await pool.query(
      `DELETE FROM movimientos WHERE articulo_id IN (
         SELECT id FROM articulos WHERE nombre = $1
       )`,
      [NOMBRE_ARTICULO_TEST],
    );
    await pool.query(
      `DELETE FROM lotes WHERE articulo_id IN (
         SELECT id FROM articulos WHERE nombre = $1
       )`,
      [NOMBRE_ARTICULO_TEST],
    );
    await pool.query(`DELETE FROM articulos WHERE nombre = $1`, [
      NOMBRE_ARTICULO_TEST,
    ]);
    await pool.query(`DELETE FROM usuarios WHERE email = $1`, [
      EMAIL_USUARIO_TEST,
    ]);

    const rol = await pool.query(
      `SELECT id FROM roles WHERE nombre = 'Almacen_Cocina'`,
    );
    const usuario = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id)
       VALUES ('Usuario Test HU-06', $1, 'hash_test', $2)
       RETURNING id`,
      [EMAIL_USUARIO_TEST, rol.rows[0].id],
    );
    usuarioId = usuario.rows[0].id;

    const cat = await pool.query(
      `SELECT id FROM categorias WHERE nombre = 'Alimentos'`,
    );
    const art = await pool.query(
      `INSERT INTO articulos (nombre, categoria_id, unidad_medida, stock_minimo)
       VALUES ($1, $2, 'kg', 5) RETURNING id`,
      [NOMBRE_ARTICULO_TEST, cat.rows[0].id],
    );
    articuloId = art.rows[0].id;

    const lote = await pool.query(
      `INSERT INTO lotes (articulo_id, numero_lote, cantidad_inicial)
       VALUES ($1, 'TEST-HU06-001', 15) RETURNING id`,
      [articuloId],
    );

    const mov = await pool.query(
      `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id)
       VALUES ('entrada', $1, 15, $2) RETURNING id`,
      [articuloId, usuarioId],
    );

    await pool.query(
      `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad) VALUES ($1, $2, 15)`,
      [mov.rows[0].id, lote.rows[0].id],
    );
  });

  afterAll(async () => {
    if (articuloId) {
      await pool.query(
        `DELETE FROM movimiento_lotes WHERE lote_id IN (SELECT id FROM lotes WHERE articulo_id = $1)`,
        [articuloId],
      );
      await pool.query(`DELETE FROM movimientos WHERE articulo_id = $1`, [
        articuloId,
      ]);
      await pool.query(`DELETE FROM lotes WHERE articulo_id = $1`, [
        articuloId,
      ]);
      await pool.query(`DELETE FROM articulos WHERE id = $1`, [articuloId]);
    }
    if (usuarioId) {
      await pool.query(`DELETE FROM usuarios WHERE id = $1`, [usuarioId]);
    }
    await pool.end();
  });

  test("el stock baja solo tras registrar una merma, y el motivo queda guardado", async () => {
    await mermaService.registrarMerma({
      articuloId,
      cantidad: 4,
      usuarioId,
      motivo: "deterioro",
    });

    const stock = await inventarioRepository.obtenerStockArticulo(articuloId);
    expect(Number(stock.stock_actual)).toBe(11); // 15 - 4

    const { rows } = await pool.query(
      `SELECT motivo FROM movimientos WHERE articulo_id = $1 AND tipo = 'merma'`,
      [articuloId],
    );
    expect(rows[0].motivo).toBe("deterioro");
  });

  test("la base de datos rechaza un motivo fuera de la lista permitida (CHECK)", async () => {
    await expect(
      pool.query(
        `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id, motivo)
         VALUES ('merma', $1, 1, $2, 'se lo comio el perro')`,
        [articuloId, usuarioId],
      ),
    ).rejects.toThrow(/violates check constraint/i);
  });
});
