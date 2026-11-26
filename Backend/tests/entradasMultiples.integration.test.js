const pool = require("../src/db/pool");
const entradaService = require("../src/services/entradaService");

jest.setTimeout(30000);

const SUF = Date.now();
const ids = {};
const q = async (sql, params) => (await pool.query(sql, params)).rows;

/** Borra todo lo que crea esta prueba (prefijo ZZM), de esta corrida o de anteriores. */
async function limpiar() {
  await q(`DELETE FROM movimiento_lotes WHERE lote_id IN (
             SELECT l.id FROM lotes l JOIN articulos a ON a.id = l.articulo_id WHERE a.nombre LIKE 'ZZM-%')`);
  await q(`DELETE FROM movimientos WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZM-%')`);
  await q(`DELETE FROM lotes WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZM-%')`);
  await q(`DELETE FROM articulos WHERE nombre LIKE 'ZZM-%'`);
  await q(`DELETE FROM donantes WHERE nombre LIKE 'ZZM %'`);
  await q(`DELETE FROM usuarios WHERE email LIKE 'zzm-%@test.local'`);
}

const stock = async (articuloId) =>
  Number(
    (await q(`SELECT COALESCE(SUM(cantidad_disponible), 0) AS s FROM lotes WHERE articulo_id = $1`, [articuloId]))[0].s,
  );
const cuenta = async (tabla, articuloId) =>
  Number((await q(`SELECT COUNT(*) AS n FROM ${tabla} WHERE articulo_id = $1`, [articuloId]))[0].n);

describe("Donación por lotes — registrarEntradasEnLote (integración, Neon)", () => {
  beforeAll(async () => {
    await limpiar();

    const rol = (await q("SELECT id FROM roles WHERE nombre = 'Recepcion'"))[0].id;
    ids.u = (
      await q(
        `INSERT INTO usuarios (nombre, email, password_hash, rol_id)
         VALUES ($1, $2, 'x', $3) RETURNING id`,
        [`ZZM Recepcion ${SUF}`, `zzm-1-${SUF}@test.local`, rol],
      )
    )[0].id;

    const cat = (await q("SELECT id FROM categorias ORDER BY id LIMIT 1"))[0].id;
    const articulo = async (nombre) =>
      (
        await q(
          `INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo)
           VALUES ($1, $2, 'kg', FALSE, 1) RETURNING id`,
          [nombre, cat],
        )
      )[0].id;
    ids.a1 = await articulo(`ZZM-Arroz-${SUF}`);
    ids.a2 = await articulo(`ZZM-Harina-${SUF}`);
    ids.a3 = await articulo(`ZZM-Azucar-${SUF}`);

    ids.d = (
      await q(`INSERT INTO donantes (nombre, tipo) VALUES ($1, 'empresa') RETURNING id`, [`ZZM Banco ${SUF}`])
    )[0].id;
  });

  afterAll(async () => {
    await limpiar();
    await pool.end();
  });

  test("registra varios artículos y suma el stock de cada uno", async () => {
    const r = await entradaService.registrarEntradasEnLote({
      usuarioId: ids.u,
      donanteId: ids.d,
      fecha: "2020-03-05",
      items: [
        { articuloId: ids.a1, cantidad: 20, numeroLote: "ZZM-L1", fechaVencimiento: "2099-12-31" },
        { articuloId: ids.a2, cantidad: "7.5" },
      ],
    });

    expect(r.total).toBe(2);
    expect(r.entradas.map((e) => e.articuloId)).toEqual([ids.a1, ids.a2]);
    expect(await stock(ids.a1)).toBe(20);
    expect(await stock(ids.a2)).toBe(7.5);

    const movs = await q(
      `SELECT tipo, donante_id, usuario_id FROM movimientos WHERE id = ANY($1)`,
      [r.entradas.map((e) => e.movimientoId)],
    );
    expect(movs).toHaveLength(2);
    movs.forEach((m) => {
      expect(m).toMatchObject({ tipo: "entrada", donante_id: ids.d, usuario_id: ids.u });
    });

    const lote = (await q(`SELECT numero_lote, fecha_vencimiento::text AS v, fecha_ingreso::text AS f FROM lotes WHERE id = $1`, [r.entradas[0].loteId]))[0];
    expect(lote).toEqual({ numero_lote: "ZZM-L1", v: "2099-12-31", f: "2020-03-05" });
  });

  test("el mismo artículo puede repetirse con lotes distintos", async () => {
    await entradaService.registrarEntradasEnLote({
      usuarioId: ids.u,
      items: [
        { articuloId: ids.a3, cantidad: 4, numeroLote: "ZZM-A", fechaVencimiento: "2098-01-01" },
        { articuloId: ids.a3, cantidad: 6, numeroLote: "ZZM-B", fechaVencimiento: "2099-01-01" },
      ],
    });
    expect(await stock(ids.a3)).toBe(10);
    expect(await cuenta("lotes", ids.a3)).toBe(2);
  });

  test("es todo o nada: si un ítem falla, no se guarda ninguno", async () => {
    const antesLotes = await cuenta("lotes", ids.a1);
    const antesMovs = await cuenta("movimientos", ids.a1);
    const antesStock = await stock(ids.a1);

    await expect(
      entradaService.registrarEntradasEnLote({
        usuarioId: ids.u,
        items: [
          { articuloId: ids.a1, cantidad: 100 },
          { articuloId: 2147483647, cantidad: 1 }, // artículo inexistente
        ],
      }),
    ).rejects.toThrow(/no existe/);

    expect(await cuenta("lotes", ids.a1)).toBe(antesLotes);
    expect(await cuenta("movimientos", ids.a1)).toBe(antesMovs);
    expect(await stock(ids.a1)).toBe(antesStock);
  });

  test("valida los datos antes de tocar la base", async () => {
    const reg = (datos) => entradaService.registrarEntradasEnLote({ usuarioId: ids.u, ...datos });
    await expect(reg({ items: [] })).rejects.toThrow(/al menos un artículo/);
    await expect(reg({ items: "x" })).rejects.toThrow(/al menos un artículo/);
    await expect(reg({ items: [{ cantidad: 1 }] })).rejects.toThrow(/ítem #1: articuloId/);
    await expect(reg({ items: [{ articuloId: ids.a1, cantidad: 1 }, { articuloId: ids.a2, cantidad: 0 }] })).rejects.toThrow(/ítem #2: la cantidad/);
    await expect(
      reg({ items: Array.from({ length: 51 }, () => ({ articuloId: ids.a1, cantidad: 1 })) }),
    ).rejects.toThrow(/máximo 50/);
    await expect(
      entradaService.registrarEntradasEnLote({ items: [{ articuloId: ids.a1, cantidad: 1 }] }),
    ).rejects.toThrow(/usuarioId/);
  });

  test("un donante inexistente también revierte todo", async () => {
    const antes = await stock(ids.a2);
    await expect(
      entradaService.registrarEntradasEnLote({
        usuarioId: ids.u,
        donanteId: 2147483647,
        items: [{ articuloId: ids.a2, cantidad: 3 }],
      }),
    ).rejects.toThrow(/no existe/);
    expect(await stock(ids.a2)).toBe(antes);
  });
});
