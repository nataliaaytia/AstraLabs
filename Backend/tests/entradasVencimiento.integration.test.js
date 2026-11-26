const pool = require("../src/db/pool");
const entradaService = require("../src/services/entradaService");

jest.setTimeout(30000);

const SUF = Date.now();
const ids = {};
const q = async (sql, params) => (await pool.query(sql, params)).rows;

/** Borra todo lo que crea esta prueba (prefijo ZZV). */
async function limpiar() {
  await q(`DELETE FROM movimiento_lotes WHERE lote_id IN (
             SELECT l.id FROM lotes l JOIN articulos a ON a.id = l.articulo_id WHERE a.nombre LIKE 'ZZV-%')`);
  await q(`DELETE FROM movimientos WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZV-%')`);
  await q(`DELETE FROM lotes WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZV-%')`);
  await q(`DELETE FROM articulos WHERE nombre LIKE 'ZZV-%'`);
  await q(`DELETE FROM usuarios WHERE email LIKE 'zzv-%@test.local'`);
}

const stock = async (id) =>
  Number((await q(`SELECT COALESCE(SUM(cantidad_disponible),0) AS s FROM lotes WHERE articulo_id = $1`, [id]))[0].s);
const lotes = async (id) => Number((await q(`SELECT COUNT(*) AS n FROM lotes WHERE articulo_id = $1`, [id]))[0].n);

describe("HU-04 — vencimiento y lote al registrar perecederos y medicinas (integración, Neon)", () => {
  beforeAll(async () => {
    await limpiar();
    const rol = (await q("SELECT id FROM roles WHERE nombre = 'Recepcion'"))[0].id;
    ids.u = (
      await q(`INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ($1,$2,'x',$3) RETURNING id`,
        [`ZZV Recepcion ${SUF}`, `zzv-1-${SUF}@test.local`, rol])
    )[0].id;

    const alimentos = (await q("SELECT id FROM categorias WHERE nombre = 'Alimentos'"))[0].id;
    const medicinas = (await q("SELECT id FROM categorias WHERE nombre = 'Medicinas'"))[0].id;
    const articulo = async (nombre, cat, perecedero) =>
      (
        await q(`INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo)
                 VALUES ($1,$2,'u',$3,1) RETURNING id`, [nombre, cat, perecedero])
      )[0].id;
    ids.leche = await articulo(`ZZV-Leche-${SUF}`, alimentos, true);
    ids.arroz = await articulo(`ZZV-Arroz-${SUF}`, alimentos, false);
    ids.med = await articulo(`ZZV-Paracetamol-${SUF}`, medicinas, false);
  });

  afterAll(async () => {
    await limpiar();
    await pool.end();
  });

  const dia = (d) => {
    const f = new Date(Date.UTC(2026, 10, 23) + d * 86400000);
    return f.toISOString().slice(0, 10);
  };
  const REC = "2026-11-23";

  test("un perecedero sin vencimiento ni lote se rechaza y no guarda nada", async () => {
    await expect(
      entradaService.registrarEntrada({ articuloId: ids.leche, cantidad: 5, usuarioId: ids.u, fecha: REC }),
    ).rejects.toThrow(/perecedero o medicina/);
    expect(await lotes(ids.leche)).toBe(0);
    expect(await stock(ids.leche)).toBe(0);
  });

  test("un perecedero con vencimiento y lote se registra y queda trazable", async () => {
    const r = await entradaService.registrarEntrada({
      articuloId: ids.leche, cantidad: 12, usuarioId: ids.u, fecha: REC,
      numeroLote: "ZZV-L1", fechaVencimiento: dia(30),
    });
    expect(r.advertencias).toEqual([]);
    const lote = (await q(`SELECT numero_lote, fecha_vencimiento::text AS v FROM lotes WHERE id = $1`, [r.loteId]))[0];
    expect(lote).toEqual({ numero_lote: "ZZV-L1", v: dia(30) });
    expect(await stock(ids.leche)).toBe(12);
  });

  test("una medicina exige lote y vencimiento aunque no esté marcada como perecedera", async () => {
    await expect(
      entradaService.registrarEntrada({ articuloId: ids.med, cantidad: 3, usuarioId: ids.u, fecha: REC }),
    ).rejects.toThrow(/Paracetamol/);
    await entradaService.registrarEntrada({
      articuloId: ids.med, cantidad: 3, usuarioId: ids.u, fecha: REC, numeroLote: "ZZV-M1", fechaVencimiento: dia(90),
    });
    expect(await stock(ids.med)).toBe(3);
  });

  test("un no perecedero se sigue registrando sin lote ni vencimiento", async () => {
    await entradaService.registrarEntrada({ articuloId: ids.arroz, cantidad: 8, usuarioId: ids.u, fecha: REC });
    expect(await stock(ids.arroz)).toBe(8);
  });

  test("vencido hace 10 días: se acepta en observación y queda anotado en el movimiento", async () => {
    const r = await entradaService.registrarEntrada({
      articuloId: ids.leche, cantidad: 2, usuarioId: ids.u, fecha: REC,
      numeroLote: "ZZV-L2", fechaVencimiento: dia(-10),
    });
    expect(r.advertencias).toHaveLength(1);
    const mov = (await q(`SELECT observaciones FROM movimientos WHERE id = $1`, [r.movimientoId]))[0];
    expect(mov.observaciones).toMatch(/En observación.*10 día/);
    expect(await stock(ids.leche)).toBe(14);
  });

  test("vencido hace 21 días se acepta; hace 22 se rechaza", async () => {
    await entradaService.registrarEntrada({
      articuloId: ids.leche, cantidad: 1, usuarioId: ids.u, fecha: REC, numeroLote: "ZZV-L3", fechaVencimiento: dia(-21),
    });
    await expect(
      entradaService.registrarEntrada({
        articuloId: ids.leche, cantidad: 1, usuarioId: ids.u, fecha: REC, numeroLote: "ZZV-L4", fechaVencimiento: dia(-22),
      }),
    ).rejects.toThrow(/venció hace 22 días/);
    expect(await stock(ids.leche)).toBe(15);
  });

  test("donación múltiple: si un perecedero no trae lote, no se guarda ningún ítem", async () => {
    const antes = await stock(ids.arroz);
    await expect(
      entradaService.registrarEntradasEnLote({
        usuarioId: ids.u, fecha: REC,
        items: [{ articuloId: ids.arroz, cantidad: 50 }, { articuloId: ids.leche, cantidad: 5, fechaVencimiento: dia(10) }],
      }),
    ).rejects.toThrow(/ítem #2.*número de lote es obligatorio/);
    expect(await stock(ids.arroz)).toBe(antes);
  });

  test("donación múltiple con advertencias: devuelve cuáles quedaron en observación", async () => {
    const r = await entradaService.registrarEntradasEnLote({
      usuarioId: ids.u, fecha: REC,
      items: [
        { articuloId: ids.leche, cantidad: 1, numeroLote: "ZZV-L5", fechaVencimiento: dia(-5) },
        { articuloId: ids.arroz, cantidad: 1 },
      ],
    });
    expect(r.total).toBe(2);
    expect(r.advertencias).toHaveLength(1);
    expect(r.advertencias[0]).toMatch(/^ítem #1: /);
  });
});
