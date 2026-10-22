const pool = require("../db/pool");
const salidaService = require("./salidaService");
const inventarioRepository = require("../repositories/inventarioRepository");

/**
 * Prueba de integración (RF-05): no usa mocks. Inserta datos reales,
 * ejecuta el servicio y verifica que el trigger de la base de datos
 * recalculó el stock sin que el código llamara a ningún UPDATE manual.
 *
 * Requiere: variable DATABASE_URL apuntando a una base con schema.sql
 * ya cargado (ver README). Crea y borra sus propios datos de prueba,
 * así que se puede correr repetidas veces sin dejar basura.
 */
describe("HU-05 - actualización automática de stock (integración)", () => {
  let articuloId;
  let usuarioId;

  beforeAll(async () => {
    await pool.query("SELECT 1");

    // Limpieza preventiva: por si una corrida anterior se interrumpió a medias
    // y dejó basura de ejecuciones pasadas con el mismo nombre de prueba.
    await pool.query(`
    DELETE FROM movimiento_lotes WHERE lote_id IN (
      SELECT l.id FROM lotes l
      JOIN articulos a ON a.id = l.articulo_id
      WHERE a.nombre = 'Articulo Test HU-05'
    )
  `);
    await pool.query(`
    DELETE FROM movimientos WHERE articulo_id IN (
      SELECT id FROM articulos WHERE nombre = 'Articulo Test HU-05'
    )
  `);
    await pool.query(`
    DELETE FROM lotes WHERE articulo_id IN (
      SELECT id FROM articulos WHERE nombre = 'Articulo Test HU-05'
    )
  `);
    await pool.query(
      `DELETE FROM articulos WHERE nombre = 'Articulo Test HU-05'`,
    );
    await pool.query(
      `DELETE FROM usuarios WHERE email = 'test-hu05@astralabs.test'`,
    );

    // A partir de aquí, el resto queda igual que antes:
    const rol = await pool.query(
      `SELECT id FROM roles WHERE nombre = 'Administradora'`,
    );
    const usuario = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id)
     VALUES ('Usuario Test HU-05', 'test-hu05@astralabs.test', 'hash_test', $1)
     RETURNING id`,
      [rol.rows[0].id],
    );
    usuarioId = usuario.rows[0].id;

    const cat = await pool.query(
      `SELECT id FROM categorias WHERE nombre = 'Alimentos'`,
    );
    const art = await pool.query(
      `INSERT INTO articulos (nombre, categoria_id, unidad_medida, stock_minimo)
     VALUES ('Articulo Test HU-05', $1, 'kg', 5) RETURNING id`,
      [cat.rows[0].id],
    );
    articuloId = art.rows[0].id;

    const lote = await pool.query(
      `INSERT INTO lotes (articulo_id, numero_lote, cantidad_inicial)
     VALUES ($1, 'TEST-001', 20) RETURNING id`,
      [articuloId],
    );

    const mov = await pool.query(
      `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id)
     VALUES ('entrada', $1, 20, $2) RETURNING id`,
      [articuloId, usuarioId],
    );

    await pool.query(
      `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad) VALUES ($1, $2, 20)`,
      [mov.rows[0].id, lote.rows[0].id],
    );
  });

  afterAll(async () => {
    // Limpieza: deja la base igual que la encontró, para poder correr el test de nuevo
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

  test("el stock sube solo tras una entrada, sin UPDATE manual", async () => {
    const stock = await inventarioRepository.obtenerStockArticulo(articuloId);
    expect(Number(stock.stock_actual)).toBe(20);
  });

  test("el stock baja solo tras registrar una salida (RF-03 + RF-05)", async () => {
    await salidaService.registrarSalida({
      articuloId,
      cantidad: 7,
      usuarioId,
      destino: "Cocina",
    });

    const stock = await inventarioRepository.obtenerStockArticulo(articuloId);
    expect(Number(stock.stock_actual)).toBe(13);
  });
});
