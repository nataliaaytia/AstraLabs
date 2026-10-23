const pool = require("../db/pool");
const excedenteService = require("./excedenteService");
const inventarioRepository = require("../repositories/inventarioRepository");

const NOMBRE_ARTICULO_TEST = "Articulo Test HU-09";
const EMAIL_USUARIO_TEST = "test-hu09@astralabs.test";

describe("Excedentes — integración real (RF-09)", () => {
  let usuarioId;
  let articuloId;
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

    const rol = await pool.query(
      `SELECT id FROM roles WHERE nombre = 'Almacen_Cocina'`,
    );
    const usuario = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ($1, $2, 'x', $3) RETURNING id`,
      ["Usuario Test HU-09", EMAIL_USUARIO_TEST, rol.rows[0].id],
    );
    usuarioId = usuario.rows[0].id;

    const categoria = await pool.query(
      `SELECT id FROM categorias WHERE nombre = 'Alimentos'`,
    );
    const articulo = await pool.query(
      `INSERT INTO articulos (nombre, categoria_id, unidad_medida, stock_minimo) VALUES ($1, $2, 'kg', 1) RETURNING id`,
      [NOMBRE_ARTICULO_TEST, categoria.rows[0].id],
    );
    articuloId = articulo.rows[0].id;

    const lote = await pool.query(
      `INSERT INTO lotes (articulo_id, numero_lote, cantidad_inicial) VALUES ($1, 'LOTE-HU09', 20) RETURNING id`,
      [articuloId],
    );
    loteId = lote.rows[0].id;

    const entrada = await pool.query(
      `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id) VALUES ('entrada', $1, 20, $2) RETURNING id`,
      [articuloId, usuarioId],
    );
    await pool.query(
      `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad) VALUES ($1, $2, 20)`,
      [entrada.rows[0].id, loteId],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM movimiento_lotes WHERE lote_id = $1`, [
      loteId,
    ]);
    await pool.query(`DELETE FROM movimientos WHERE articulo_id = $1`, [
      articuloId,
    ]);
    await pool.query(`DELETE FROM lotes WHERE id = $1`, [loteId]);
    await pool.query(`DELETE FROM articulos WHERE id = $1`, [articuloId]);
    await pool.query(`DELETE FROM usuarios WHERE id = $1`, [usuarioId]);
    await pool.end();
  });

  test("registra un excedente, descuenta el lote y guarda el destino", async () => {
    const stockAntes =
      await inventarioRepository.obtenerStockArticulo(articuloId);
    expect(Number(stockAntes.stock_actual)).toBe(20);

    await excedenteService.registrarExcedente({
      articuloId,
      cantidad: 6,
      usuarioId,
      destino: "Donación - Casa Hermana",
    });

    const stockDespues =
      await inventarioRepository.obtenerStockArticulo(articuloId);
    expect(Number(stockDespues.stock_actual)).toBe(14);

    const { rows } = await pool.query(
      `SELECT tipo, destino FROM movimientos WHERE articulo_id = $1 AND tipo = 'excedente'`,
      [articuloId],
    );
    expect(rows[0].tipo).toBe("excedente");
    expect(rows[0].destino).toBe("Donación - Casa Hermana");
  });

  test("rechaza un excedente sin destino", async () => {
    await expect(
      excedenteService.registrarExcedente({
        articuloId,
        cantidad: 1,
        usuarioId,
        destino: "",
      }),
    ).rejects.toThrow("destino es obligatorio");
  });
});
