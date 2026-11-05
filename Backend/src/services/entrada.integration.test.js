const pool = require("../db/pool");
const entradaService = require("./entradaService");
const inventarioRepository = require("../repositories/inventarioRepository");

const NOMBRE_ARTICULO_TEST = "Articulo Test HU-02";
const EMAIL_USUARIO_TEST = "test-hu02@astralabs.test";
const NOMBRE_DONANTE_TEST = "Donante Test HU-02";

describe("Entradas — integración real (RF-02)", () => {
  let usuarioId;
  let articuloId;
  let donanteId;
  let loteId;

  beforeAll(async () => {
    // Limpieza preventiva por si quedó algo de una corrida interrumpida.
    await pool.query(
      `DELETE FROM movimiento_lotes WHERE lote_id IN (
         SELECT l.id FROM lotes l JOIN articulos a ON a.id = l.articulo_id WHERE a.nombre = $1
       )`,
      [NOMBRE_ARTICULO_TEST],
    );
    await pool.query(
      `DELETE FROM movimientos WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre = $1)`,
      [NOMBRE_ARTICULO_TEST],
    );
    await pool.query(
      `DELETE FROM lotes WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre = $1)`,
      [NOMBRE_ARTICULO_TEST],
    );
    await pool.query(`DELETE FROM articulos WHERE nombre = $1`, [
      NOMBRE_ARTICULO_TEST,
    ]);
    await pool.query(`DELETE FROM usuarios WHERE email = $1`, [
      EMAIL_USUARIO_TEST,
    ]);
    await pool.query(`DELETE FROM donantes WHERE nombre = $1`, [
      NOMBRE_DONANTE_TEST,
    ]);

    const rol = await pool.query(
      `SELECT id FROM roles WHERE nombre = 'Recepcion'`,
    );
    const usuario = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ($1, $2, 'x', $3) RETURNING id`,
      ["Usuario Test HU-02", EMAIL_USUARIO_TEST, rol.rows[0].id],
    );
    usuarioId = usuario.rows[0].id;

    const donante = await pool.query(
      `INSERT INTO donantes (nombre, tipo) VALUES ($1, 'persona') RETURNING id`,
      [NOMBRE_DONANTE_TEST],
    );
    donanteId = donante.rows[0].id;

    const categoria = await pool.query(
      `SELECT id FROM categorias WHERE nombre = 'Alimentos'`,
    );
    const articulo = await pool.query(
      `INSERT INTO articulos (nombre, categoria_id, unidad_medida, stock_minimo) VALUES ($1, $2, 'kg', 1) RETURNING id`,
      [NOMBRE_ARTICULO_TEST, categoria.rows[0].id],
    );
    articuloId = articulo.rows[0].id;
  });

  afterAll(async () => {
    if (loteId)
      await pool.query(`DELETE FROM movimiento_lotes WHERE lote_id = $1`, [
        loteId,
      ]);
    await pool.query(`DELETE FROM movimientos WHERE articulo_id = $1`, [
      articuloId,
    ]);
    await pool.query(`DELETE FROM lotes WHERE articulo_id = $1`, [articuloId]);
    await pool.query(`DELETE FROM articulos WHERE id = $1`, [articuloId]);
    await pool.query(`DELETE FROM usuarios WHERE id = $1`, [usuarioId]);
    await pool.query(`DELETE FROM donantes WHERE id = $1`, [donanteId]);
    await pool.end();
  });

  test("registra una entrada, crea el lote y sube el stock en esa cantidad", async () => {
    const stockAntes =
      await inventarioRepository.obtenerStockArticulo(articuloId);
    expect(Number(stockAntes.stock_actual)).toBe(0);

    const resultado = await entradaService.registrarEntrada({
      articuloId,
      cantidad: 30,
      usuarioId,
      donanteId,
      fecha: "2026-11-04",
      fechaVencimiento: "2027-05-01",
      numeroLote: "DON-HU02-1",
    });

    loteId = resultado.loteId;

    const stockDespues =
      await inventarioRepository.obtenerStockArticulo(articuloId);
    expect(Number(stockDespues.stock_actual)).toBe(30);

    const { rows } = await pool.query(
      `SELECT tipo, donante_id, cantidad_total FROM movimientos WHERE id = $1`,
      [resultado.movimientoId],
    );
    expect(rows[0].tipo).toBe("entrada");
    expect(rows[0].donante_id).toBe(donanteId);
    expect(Number(rows[0].cantidad_total)).toBe(30);

    const lote = await pool.query(
      `SELECT cantidad_inicial, cantidad_disponible, numero_lote FROM lotes WHERE id = $1`,
      [loteId],
    );
    expect(Number(lote.rows[0].cantidad_inicial)).toBe(30);
    expect(Number(lote.rows[0].cantidad_disponible)).toBe(30);
    expect(lote.rows[0].numero_lote).toBe("DON-HU02-1");
  });

  test("rechaza una entrada con cantidad inválida", async () => {
    await expect(
      entradaService.registrarEntrada({ articuloId, cantidad: 0, usuarioId }),
    ).rejects.toThrow("La cantidad debe ser mayor a cero");
  });
});
