// Backend/src/services/stock.integration.test.js
const pool = require("../db/pool");
const salidaService = require("./salidaService");

/**
 * Prueba de integración (RF-05): no usa mocks. Inserta datos reales,
 * ejecuta el servicio y verifica que el trigger de la base de datos
 * recalculó el stock sin que el código llamara a ningún UPDATE manual.
 *
 * Requiere: Postgres corriendo localmente con schema.sql ya cargado
 * (ver README). Se salta sola si no hay conexión disponible.
 */
describe("HU-05 - actualización automática de stock (integración)", () => {
  let articuloId;

  beforeAll(async () => {
    try {
      await pool.query("SELECT 1");
    } catch {
      return; // sin DB disponible, los tests se saltan abajo
    }

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
       VALUES ('entrada', $1, 20, 1) RETURNING id`,
      [articuloId],
    );

    await pool.query(
      `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad) VALUES ($1, $2, 20)`,
      [mov.rows[0].id, lote.rows[0].id],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  test("el stock sube solo tras una entrada, sin UPDATE manual", async () => {
    if (!articuloId) return; // sin DB, se salta

    const inventarioRepository = require("../repositories/inventarioRepository");
    const stock = await inventarioRepository.obtenerStockArticulo(articuloId);

    expect(Number(stock.stock_actual)).toBe(20);
  });

  test("el stock baja solo tras registrar una salida (RF-03 + RF-05)", async () => {
    if (!articuloId) return;

    await salidaService.registrarSalida({
      articuloId,
      cantidad: 7,
      usuarioId: 1,
      destino: "Cocina",
    });

    const inventarioRepository = require("../repositories/inventarioRepository");
    const stock = await inventarioRepository.obtenerStockArticulo(articuloId);

    expect(Number(stock.stock_actual)).toBe(13);
  });
});
