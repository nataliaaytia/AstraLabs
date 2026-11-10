const pool = require("../db/pool");
const salidaService = require("./salidaService");
const inventarioRepository = require("../repositories/inventarioRepository");

const NOMBRE_ARTICULO_TEST = "Articulo Test HU-20";
const EMAIL_USUARIO_TEST = "test-hu20@astralabs.test";

describe("FEFO — integración real, prioriza el lote más próximo a vencer (RF-20)", () => {
  let usuarioId;
  let articuloId;
  let loteProntoAVencerId;
  let loteLejanoId;

  beforeAll(async () => {
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
      ["Usuario Test HU-20", EMAIL_USUARIO_TEST, rol.rows[0].id],
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

    // Dos lotes del MISMO artículo, con distinta fecha de vencimiento, cargados
    // en orden inverso al que deberían consumirse (el que vence después entra primero),
    // justamente para probar que el orden de carga no influye — solo la fecha de vencimiento.
    const loteLejano = await pool.query(
      `INSERT INTO lotes (articulo_id, numero_lote, fecha_vencimiento, cantidad_inicial)
       VALUES ($1, 'LOTE-LEJANO-HU20', '2099-12-31', 10) RETURNING id`,
      [articuloId],
    );
    loteLejanoId = loteLejano.rows[0].id;

    const loteProntoAVencer = await pool.query(
      `INSERT INTO lotes (articulo_id, numero_lote, fecha_vencimiento, cantidad_inicial)
       VALUES ($1, 'LOTE-PRONTO-HU20', '2099-01-15', 10) RETURNING id`,
      [articuloId],
    );
    loteProntoAVencerId = loteProntoAVencer.rows[0].id;

    for (const loteId of [loteLejanoId, loteProntoAVencerId]) {
      const entrada = await pool.query(
        `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id) VALUES ('entrada', $1, 10, $2) RETURNING id`,
        [articuloId, usuarioId],
      );
      await pool.query(
        `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad) VALUES ($1, $2, 10)`,
        [entrada.rows[0].id, loteId],
      );
    }
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM movimiento_lotes WHERE lote_id IN ($1, $2)`, [
      loteProntoAVencerId,
      loteLejanoId,
    ]);
    await pool.query(`DELETE FROM movimientos WHERE articulo_id = $1`, [
      articuloId,
    ]);
    await pool.query(`DELETE FROM lotes WHERE id IN ($1, $2)`, [
      loteProntoAVencerId,
      loteLejanoId,
    ]);
    await pool.query(`DELETE FROM articulos WHERE id = $1`, [articuloId]);
    await pool.query(`DELETE FROM usuarios WHERE id = $1`, [usuarioId]);
    await pool.end();
  });

  async function stockDeLote(loteId) {
    const { rows } = await pool.query(
      `SELECT cantidad_disponible FROM lotes WHERE id = $1`,
      [loteId],
    );
    return Number(rows[0].cantidad_disponible);
  }

  test("una salida parcial descuenta solo del lote que vence antes, sin tocar el que vence después", async () => {
    await salidaService.registrarSalida({
      articuloId,
      cantidad: 6,
      usuarioId,
      destino: "Prueba FEFO HU-20",
    });

    expect(await stockDeLote(loteProntoAVencerId)).toBe(4); // 10 - 6
    expect(await stockDeLote(loteLejanoId)).toBe(10); // intacto
  });

  test("al agotarse el lote próximo a vencer, la siguiente salida se reparte hacia el que vence después", async () => {
    // Quedan 4 en el lote próximo a vencer; pedir 6 obliga a repartir: 4 de ahí + 2 del lejano.
    await salidaService.registrarSalida({
      articuloId,
      cantidad: 6,
      usuarioId,
      destino: "Prueba FEFO HU-20 (reparto)",
    });

    expect(await stockDeLote(loteProntoAVencerId)).toBe(0);
    expect(await stockDeLote(loteLejanoId)).toBe(8); // 10 - 2

    const stockTotal =
      await inventarioRepository.obtenerStockArticulo(articuloId);
    expect(Number(stockTotal.stock_actual)).toBe(8);
  });
});
