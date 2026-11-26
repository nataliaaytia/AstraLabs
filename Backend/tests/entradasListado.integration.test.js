const pool = require("../src/db/pool");
const entradaService = require("../src/services/entradaService");

jest.setTimeout(30000);

const SUF = Date.now();
const ids = {};
const q = async (sql, params) => (await pool.query(sql, params)).rows;

/** Borra todo lo que crea esta prueba (prefijo ZZE), de esta corrida o de anteriores. */
async function limpiar() {
  await q(`DELETE FROM movimiento_lotes WHERE lote_id IN (
             SELECT l.id FROM lotes l JOIN articulos a ON a.id = l.articulo_id WHERE a.nombre LIKE 'ZZE-%')`);
  await q(
    `DELETE FROM movimientos WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZE-%')`,
  );
  await q(
    `DELETE FROM lotes WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZE-%')`,
  );
  await q(`DELETE FROM articulos WHERE nombre LIKE 'ZZE-%'`);
  await q(`DELETE FROM donantes WHERE nombre LIKE 'ZZE %'`);
  await q(`DELETE FROM usuarios WHERE email LIKE 'zze-%@test.local'`);
}

describe("Historial de donaciones — listarEntradas (integración, Neon)", () => {
  beforeAll(async () => {
    await limpiar();

    const rol = (await q("SELECT id FROM roles WHERE nombre = 'Recepcion'"))[0]
      .id;
    ids.u = (
      await q(
        `INSERT INTO usuarios (nombre, email, password_hash, rol_id)
         VALUES ($1, $2, 'x', $3) RETURNING id`,
        [`ZZE Recepcion ${SUF}`, `zze-1-${SUF}@test.local`, rol],
      )
    )[0].id;

    const cat = (await q("SELECT id FROM categorias ORDER BY id LIMIT 1"))[0]
      .id;
    const articulo = async (nombre) =>
      (
        await q(
          `INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo)
           VALUES ($1, $2, 'kg', FALSE, 1) RETURNING id`,
          [nombre, cat],
        )
      )[0].id;
    ids.arroz = await articulo(`ZZE-Arroz-${SUF}`);
    ids.harina = await articulo(`ZZE-Harina-${SUF}`);

    const donante = async (nombre) =>
      (
        await q(
          `INSERT INTO donantes (nombre, tipo) VALUES ($1, 'empresa') RETURNING id`,
          [nombre],
        )
      )[0].id;
    ids.d1 = await donante(`ZZE Banco ${SUF}`);
    ids.d2 = await donante(`ZZE Panadería ${SUF}`);

    // Se registran en este orden: e1, e2, e3 (el historial debe salir e3, e2, e1)
    ids.e1 = (
      await entradaService.registrarEntrada({
        articuloId: ids.arroz,
        cantidad: 10,
        usuarioId: ids.u,
        donanteId: ids.d1,
        fecha: "2020-01-10",
      })
    ).movimientoId;
    ids.e2 = (
      await entradaService.registrarEntrada({
        articuloId: ids.harina,
        cantidad: 5,
        usuarioId: ids.u,
        donanteId: ids.d2,
        fecha: "2020-01-20",
        numeroLote: "ZZE-L1",
        fechaVencimiento: "2099-12-31",
      })
    ).movimientoId;
    ids.e3 = (
      await entradaService.registrarEntrada({
        articuloId: ids.arroz,
        cantidad: 7.5,
        usuarioId: ids.u,
        fecha: "2020-02-01",
      })
    ).movimientoId;
  });

  afterAll(async () => {
    await limpiar();
    await pool.end();
  });

  const listar = (filtros = {}) =>
    entradaService.listarEntradas({ q: "ZZE-", ...filtros });

  test("devuelve las entradas, la más reciente primero", async () => {
    const r = await listar();
    expect(r.map((e) => e.id)).toEqual([ids.e3, ids.e2, ids.e1]);
    expect(r.map((e) => e.cantidad)).toEqual([7.5, 5, 10]);
  });

  test("cada entrada trae artículo, donante, lote, fechas y quién la registró", async () => {
    const e2 = (await listar()).find((e) => e.id === ids.e2);
    expect(e2).toMatchObject({
      articulo: `ZZE-Harina-${SUF}`,
      unidad_medida: "kg",
      cantidad: 5,
      donante: `ZZE Panadería ${SUF}`,
      numero_lote: "ZZE-L1",
      fecha_vencimiento: "2099-12-31",
      fecha: "2020-01-20",
      registrado_por: `ZZE Recepcion ${SUF}`,
    });
    expect(typeof e2.cantidad).toBe("number");
    expect(e2.registrado_en).toBeTruthy();
  });

  test("una entrada sin donante sale con donante null", async () => {
    const e3 = (await listar()).find((e) => e.id === ids.e3);
    expect(e3.donante).toBeNull();
  });

  test("q busca por artículo y por donante", async () => {
    expect((await listar({ q: "ZZE-Arroz" })).map((e) => e.id)).toEqual([
      ids.e3,
      ids.e1,
    ]);
    expect(
      (await entradaService.listarEntradas({ q: "ZZE Panadería" })).map(
        (e) => e.id,
      ),
    ).toEqual([ids.e2]);
  });

  test("donanteId", async () => {
    expect((await listar({ donanteId: ids.d1 })).map((e) => e.id)).toEqual([
      ids.e1,
    ]);
  });

  test("desde y hasta filtran por fecha de recepción", async () => {
    const r = await listar({ desde: "2020-01-15", hasta: "2020-01-31" });
    expect(r.map((e) => e.id)).toEqual([ids.e2]);
  });

  test("limite recorta a las más recientes", async () => {
    const r = await listar({ limite: 2 });
    expect(r.map((e) => e.id)).toEqual([ids.e3, ids.e2]);
  });

  test("filtros inválidos lanzan error", async () => {
    await expect(listar({ limite: 0 })).rejects.toThrow(/limite debe ser/);
    await expect(listar({ limite: 101 })).rejects.toThrow(/limite debe ser/);
    await expect(listar({ limite: "abc" })).rejects.toThrow(/limite debe ser/);
    await expect(listar({ donanteId: "x" })).rejects.toThrow(
      /donanteId debe ser/,
    );
    await expect(listar({ desde: "15/01/2020" })).rejects.toThrow(
      /desde debe tener formato/,
    );
  });
});
