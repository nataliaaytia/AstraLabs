const pool = require("../src/db/pool");
const catalogoRepository = require("../src/repositories/catalogoRepository");
const loteRepository = require("../src/repositories/loteRepository");
const donanteRepository = require("../src/repositories/donanteRepository");
const menuRepository = require("../src/repositories/menuRepository");
const inventarioRepository = require("../src/repositories/inventarioRepository");
const usuarioRepository = require("../src/repositories/usuarioRepository");
const planComidaService = require("../src/services/planComidaService");

jest.setTimeout(30000);

const SUF = Date.now();
// Año distinto en cada corrida: (fecha, tipo_comida) es UNIQUE en planes_comida
// y así nunca choca con datos que haya dejado una corrida interrumpida.
const ANIO = 3000 + (SUF % 6000);
const f = (mmdd) => `${ANIO}-${mmdd}`;
const ids = {};

async function q(sql, params) {
  return (await pool.query(sql, params)).rows;
}

/** Borra TODO lo que esta prueba crea (prefijo ZZF), de esta corrida o de anteriores. */
async function limpiarResiduos() {
  await q(
    `DELETE FROM planes_comida WHERE menu_id IN (SELECT id FROM menus WHERE nombre LIKE 'ZZF-%')`,
  );
  await q(`DELETE FROM movimiento_lotes WHERE lote_id IN (
             SELECT l.id FROM lotes l JOIN articulos a ON a.id = l.articulo_id WHERE a.nombre LIKE 'ZZF-%')`);
  await q(
    `DELETE FROM movimientos WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZF-%')`,
  );
  await q(
    `DELETE FROM lotes WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZF-%')`,
  );
  await q(`DELETE FROM menus WHERE nombre LIKE 'ZZF-%'`);
  await q(`DELETE FROM donantes WHERE nombre LIKE 'ZZF %'`);
  await q(`DELETE FROM articulos WHERE nombre LIKE 'ZZF-%'`);
  await q(`DELETE FROM categorias WHERE nombre LIKE 'ZZF-%'`);
  await q(`DELETE FROM usuarios WHERE email LIKE 'zzf-%@test.local'`);
}

describe("Filtros de listados (integración, Neon)", () => {
  beforeAll(async () => {
    await limpiarResiduos();

    const rolId = async (n) =>
      (await q("SELECT id FROM roles WHERE nombre = $1", [n]))[0].id;
    const crearUsuario = async (nombre, rol, i) =>
      (
        await q(
          `INSERT INTO usuarios (nombre, email, password_hash, rol_id)
           VALUES ($1, $2, 'x', $3) RETURNING id`,
          [nombre, `zzf-${i}-${SUF}@test.local`, await rolId(rol)],
        )
      )[0].id;

    ids.u1 = await crearUsuario(`ZZF Cocina ${SUF}`, "Almacen_Cocina", 1);
    ids.u2 = await crearUsuario(`ZZF Recepcion ${SUF}`, "Recepcion", 2);

    ids.c1 = (
      await q(`INSERT INTO categorias (nombre) VALUES ($1) RETURNING id`, [
        `ZZF-Cat1-${SUF}`,
      ])
    )[0].id;
    ids.c2 = (
      await q(`INSERT INTO categorias (nombre) VALUES ($1) RETURNING id`, [
        `ZZF-Cat2-${SUF}`,
      ])
    )[0].id;

    const art = async (nombre, cat, min) =>
      (
        await q(
          `INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo)
           VALUES ($1, $2, 'kg', TRUE, $3) RETURNING id`,
          [nombre, cat, min],
        )
      )[0].id;
    ids.a1 = await art(`ZZF-Arroz-${SUF}`, ids.c1, 50); // stock 15 < 50
    ids.a2 = await art(`ZZF-Harina-${SUF}`, ids.c2, 1); // stock 100 >= 1

    const lote = async (art, num, venc, disp) =>
      q(
        `INSERT INTO lotes (articulo_id, numero_lote, fecha_vencimiento, cantidad_inicial, cantidad_disponible)
         VALUES ($1, $2, $3, $4, $4)`,
        [art, num, venc, disp],
      );
    await lote(
      ids.a1,
      "ZZF-L1",
      new Date(Date.now() - 864e5).toISOString().slice(0, 10),
      10,
    ); // vencido
    await lote(
      ids.a1,
      "ZZF-L2",
      new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
      5,
    ); // por vencer
    await lote(ids.a2, null, null, 100); // sin asignar

    await q(
      `INSERT INTO donantes (nombre, tipo) VALUES ($1, 'persona'), ($2, 'empresa')`,
      [`ZZF Persona ${SUF}`, `ZZF Empresa ${SUF}`],
    );

    ids.m1 = (
      await q(`INSERT INTO menus (nombre) VALUES ($1) RETURNING id`, [
        `ZZF-Sopa-${SUF}`,
      ])
    )[0].id;
    await q(`INSERT INTO menus (nombre) VALUES ($1)`, [`ZZF-Postre-${SUF}`]);

    const plan = (fecha, tipo) =>
      planComidaService.registrarPlan({
        fecha,
        tipoComida: tipo,
        menuId: ids.m1,
        comensales: 3,
        usuarioId: ids.u1,
      });
    await plan(f("03-10"), "almuerzo");
    const p2 = await plan(f("03-11"), "desayuno");
    await plan(f("04-01"), "almuerzo");
    await q(`UPDATE planes_comida SET estado = 'confirmado' WHERE id = $1`, [
      p2.id,
    ]);

    const exc = (fecha, destino) =>
      q(
        `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id, destino, fecha)
         VALUES ('excedente', $1, 1, $2, $3, $4)`,
        [ids.a1, ids.u1, destino, fecha],
      );
    await exc(`${f("02-01")}T12:00:00Z`, "ZZF-Asilo");
    await exc(`${f("02-20")}T12:00:00Z`, "ZZF-Iglesia");
  });

  afterAll(async () => {
    await limpiarResiduos();
    await pool.end();
  });

  describe("artículos", () => {
    test("q filtra por nombre", async () => {
      const r = await catalogoRepository.listarArticulos({ q: "ZZF-Arroz" });
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(ids.a1);
    });
    test("categoriaId + q", async () => {
      const r = await catalogoRepository.listarArticulos({
        categoriaId: ids.c2,
        q: "ZZF",
      });
      expect(r.map((x) => x.id)).toEqual([ids.a2]);
    });
    test("bajoMinimo deja solo el que está bajo su mínimo", async () => {
      const r = await catalogoRepository.listarArticulos({
        q: "ZZF",
        bajoMinimo: true,
      });
      expect(r.map((x) => x.id)).toEqual([ids.a1]);
    });
    test("sin filtros devuelve ambos", async () => {
      const r = await catalogoRepository.listarArticulos({ q: "ZZF" });
      expect(r).toHaveLength(2);
    });
  });

  describe("lotes", () => {
    test("articuloId", async () => {
      expect(
        await loteRepository.listarLotes({ articuloId: ids.a1 }),
      ).toHaveLength(2);
    });
    test("estado vencido", async () => {
      const r = await loteRepository.listarLotes({
        articuloId: ids.a1,
        estado: "vencido",
      });
      expect(r.map((x) => x.codigo)).toEqual(["ZZF-L1"]);
    });
    test("estado por_vencer", async () => {
      const r = await loteRepository.listarLotes({
        articuloId: ids.a1,
        estado: "por_vencer",
      });
      expect(r.map((x) => x.codigo)).toEqual(["ZZF-L2"]);
    });
    test("estado sin_asignar y vigente", async () => {
      expect(
        await loteRepository.listarLotes({
          articuloId: ids.a2,
          estado: "sin_asignar",
        }),
      ).toHaveLength(1);
      expect(
        await loteRepository.listarLotes({
          articuloId: ids.a2,
          estado: "vigente",
        }),
      ).toHaveLength(1);
      expect(
        await loteRepository.listarLotes({
          articuloId: ids.a1,
          estado: "vigente",
        }),
      ).toHaveLength(0);
    });
    test("q por código", async () => {
      const r = await loteRepository.listarLotes({
        articuloId: ids.a1,
        q: "L2",
      });
      expect(r.map((x) => x.codigo)).toEqual(["ZZF-L2"]);
    });
  });

  describe("donantes", () => {
    test("q y tipo", async () => {
      expect(await donanteRepository.listarDonantes({ q: "ZZF" })).toHaveLength(
        2,
      );
      const r = await donanteRepository.listarDonantes({
        q: "ZZF",
        tipo: "empresa",
      });
      expect(r).toHaveLength(1);
      expect(r[0].tipo).toBe("empresa");
    });
  });

  describe("menús", () => {
    test("q por nombre", async () => {
      expect(await menuRepository.listarMenus({ q: "ZZF-" })).toHaveLength(2);
      const r = await menuRepository.listarMenus({ q: "sopa" });
      expect(r.some((m) => m.id === ids.m1)).toBe(true);
      expect(r.every((m) => /sopa/i.test(m.nombre))).toBe(true);
    });
  });

  describe("planes de comida", () => {
    const rango = () => ({ desde: f("03-01"), hasta: f("04-30") });
    test("rango desde/hasta", async () => {
      const r = await planComidaService.listarPlanes({
        desde: f("03-01"),
        hasta: f("03-31"),
      });
      expect(r.map((p) => p.fecha)).toEqual([f("03-10"), f("03-11")]);
    });
    test("fecha exacta", async () => {
      const r = await planComidaService.listarPlanes({ fecha: f("03-10") });
      expect(r).toHaveLength(1);
    });
    test("tipoComida", async () => {
      const r = await planComidaService.listarPlanes({
        ...rango(),
        tipoComida: "almuerzo",
      });
      expect(r).toHaveLength(2);
    });
    test("estado confirmado", async () => {
      const r = await planComidaService.listarPlanes({
        ...rango(),
        estado: "confirmado",
      });
      expect(r.map((p) => p.fecha)).toEqual([f("03-11")]);
    });
    test("fecha inválida lanza error", async () => {
      await expect(
        planComidaService.listarPlanes({ desde: "11/03/2099" }),
      ).rejects.toThrow(/desde debe tener formato/);
    });
  });

  describe("excedentes", () => {
    test("desde y hasta", async () => {
      const a = await inventarioRepository.listarExcedentes({
        q: "ZZF",
        desde: f("02-10"),
      });
      expect(a.map((e) => e.destino)).toEqual(["ZZF-Iglesia"]);
      const b = await inventarioRepository.listarExcedentes({
        q: "ZZF",
        hasta: f("02-10"),
      });
      expect(b.map((e) => e.destino)).toEqual(["ZZF-Asilo"]);
    });
    test("q por destino y por artículo", async () => {
      expect(
        await inventarioRepository.listarExcedentes({ q: "Iglesia" }),
      ).toHaveLength(1);
      expect(
        await inventarioRepository.listarExcedentes({ q: "ZZF-Arroz" }),
      ).toHaveLength(2);
    });
    test("fecha inválida lanza error", async () => {
      await expect(
        inventarioRepository.listarExcedentes({ hasta: "ayer" }),
      ).rejects.toThrow(/hasta debe tener formato/);
    });
  });

  describe("usuarios", () => {
    test("q y rol", async () => {
      expect(await usuarioRepository.listarUsuarios({ q: "zzf" })).toHaveLength(
        2,
      );
      const r = await usuarioRepository.listarUsuarios({
        q: "zzf",
        rol: "Recepcion",
      });
      expect(r.map((u) => u.id)).toEqual([ids.u2]);
    });
  });
});
