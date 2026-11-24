const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const pool = require("../src/db/pool");
const planComidaService = require("../src/services/planComidaService");
const entradaService = require("../src/services/entradaService");

jest.setTimeout(30000);

const SUF = Date.now();
const q = async (sql, params) => (await pool.query(sql, params)).rows;
const ids = {};
let server;
let puerto;

const token = (rol) => jwt.sign({ usuarioId: ids.u, rol }, process.env.JWT_SECRET, { expiresIn: "1h" });

function get(ruta, rol) {
  return new Promise((resolve, reject) => {
    const headers = rol ? { Authorization: `Bearer ${token(rol)}` } : {};
    http
      .get({ host: "127.0.0.1", port: puerto, path: ruta, headers }, (res) => {
        const partes = [];
        res.on("data", (p) => partes.push(p));
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(partes).toString() || "{}") }));
      })
      .on("error", reject);
  });
}

async function limpiar() {
  await q(`DELETE FROM planes_comida WHERE menu_id IN (SELECT id FROM menus WHERE nombre LIKE 'ZZQ-%')`);
  await q(`DELETE FROM menus WHERE nombre LIKE 'ZZQ-%'`);
  const arts = `SELECT id FROM articulos WHERE nombre LIKE 'ZZQ-%'`;
  await q(`DELETE FROM movimiento_lotes WHERE lote_id IN (SELECT id FROM lotes WHERE articulo_id IN (${arts}))`);
  await q(`DELETE FROM movimientos WHERE articulo_id IN (${arts})`);
  await q(`DELETE FROM lotes WHERE articulo_id IN (${arts})`);
  await q(`DELETE FROM articulos WHERE nombre LIKE 'ZZQ-%'`);
  await q(`DELETE FROM usuarios WHERE email LIKE 'zzq-%@test.local'`);
}

const corto = (i) => i.articulo.replace("ZZQ-", "").replace(`-${SUF}`, "");

describe("HU-18 — insumos que faltan para un plan de comidas (integración, Neon)", () => {
  beforeAll(async () => {
    await limpiar();
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    puerto = server.address().port;

    const rol = (await q("SELECT id FROM roles WHERE nombre = 'Almacen_Cocina'"))[0].id;
    ids.u = (
      await q(`INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ($1,$2,'x',$3) RETURNING id`,
        [`ZZQ Cocina ${SUF}`, `zzq-1-${SUF}@test.local`, rol])
    )[0].id;
    const cat = (await q("SELECT id FROM categorias ORDER BY id LIMIT 1"))[0].id;

    const articulo = async (nombre, stock) => {
      const id = (
        await q(
          `INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo)
           VALUES ($1,$2,'kg',FALSE,0) RETURNING id`,
          [`ZZQ-${nombre}-${SUF}`, cat],
        )
      )[0].id;
      if (stock > 0) await q(`INSERT INTO lotes (articulo_id, cantidad_inicial, cantidad_disponible) VALUES ($1,$2,$2)`, [id, stock]);
      return id;
    };
    ids.arroz = await articulo("Arroz", 20);
    ids.aceite = await articulo("Aceite", 2);
    ids.sal = await articulo("Sal", 0);
    ids.harina = await articulo("Harina", 5);

    const menu = async (nombre, ingredientes) => {
      const id = (await q(`INSERT INTO menus (nombre) VALUES ($1) RETURNING id`, [`ZZQ-${nombre}-${SUF}`]))[0].id;
      for (const [articuloId, porcion] of ingredientes) {
        await q(`INSERT INTO menu_ingredientes (menu_id, articulo_id, cantidad_por_porcion) VALUES ($1,$2,$3)`, [id, articuloId, porcion]);
      }
      return id;
    };
    const menuCompleto = await menu("Sopa", [[ids.arroz, 0.5], [ids.aceite, 0.1], [ids.sal, 0.01], [ids.harina, 0.25]]);
    const menuVacio = await menu("Vacio", []);

    const plan = async (fecha, tipo, menuId, estado = "planificado") =>
      (
        await q(
          `INSERT INTO planes_comida (fecha, tipo_comida, menu_id, comensales, estado, usuario_id)
           VALUES ($1,$2,$3,40,$4,$5) RETURNING id`,
          [fecha, tipo, menuId, estado, ids.u],
        )
      )[0].id;
    ids.plan = await plan("2086-03-15", "almuerzo", menuCompleto);
    ids.cancelado = await plan("2086-03-16", "desayuno", menuCompleto, "cancelado");
    ids.confirmado = await plan("2086-03-16", "merienda", menuCompleto, "confirmado");
    ids.vacio = await plan("2086-03-17", "almuerzo", menuVacio);
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await limpiar();
    await pool.end();
  });

  test("compara los insumos del menú (porción × comensales) contra el stock y señala los faltantes", async () => {
    const r = await get(`/api/planes-comida/${ids.plan}/faltantes`, "Almacen_Cocina");
    expect(r.status).toBe(200);
    expect(r.body.plan).toMatchObject({ id: ids.plan, fecha: "2086-03-15", tipo_comida: "almuerzo", comensales: 40, estado: "planificado" });
    expect(r.body).toMatchObject({ total_ingredientes: 4, con_faltantes: 3, puede_prepararse: false });

    const por = Object.fromEntries(r.body.ingredientes.map((i) => [corto(i), i]));
    expect(por.Arroz).toMatchObject({ requerida: 20, disponible: 20, faltante: 0, estado: "suficiente" }); // justo alcanza
    expect(por.Aceite).toMatchObject({ requerida: 4, disponible: 2, faltante: 2, estado: "insuficiente" });
    expect(por.Sal).toMatchObject({ requerida: 0.4, disponible: 0, faltante: 0.4, estado: "sin_stock" });
    expect(por.Harina).toMatchObject({ requerida: 10, disponible: 5, faltante: 5, estado: "insuficiente" });
    expect(por.Arroz).toMatchObject({ cantidad_por_porcion: 0.5, unidad_medida: "kg" });
  });

  test("los faltantes salen primero (sin stock, luego insuficientes, al final los que alcanzan)", async () => {
    const r = await get(`/api/planes-comida/${ids.plan}/faltantes`, "Administradora");
    expect(r.status).toBe(200);
    expect(r.body.ingredientes.map(corto)).toEqual(["Sal", "Aceite", "Harina", "Arroz"]);
  });

  test("coincide con lo que haría la confirmación: con faltantes, confirmar falla y no descuenta nada", async () => {
    await expect(planComidaService.confirmarPlan({ planId: ids.plan, usuarioId: ids.u })).rejects.toThrow();
    const stock = (await q(`SELECT COALESCE(SUM(cantidad_disponible),0) AS s FROM lotes WHERE articulo_id = $1`, [ids.arroz]))[0].s;
    expect(Number(stock)).toBe(20);
  });

  test("al reponer lo que falta, el plan queda listo y se puede confirmar", async () => {
    await entradaService.registrarEntrada({ articuloId: ids.aceite, cantidad: 2, usuarioId: ids.u });
    await entradaService.registrarEntrada({ articuloId: ids.harina, cantidad: 5, usuarioId: ids.u });
    await entradaService.registrarEntrada({ articuloId: ids.sal, cantidad: 1, usuarioId: ids.u });

    const r = await get(`/api/planes-comida/${ids.plan}/faltantes`, "Almacen_Cocina");
    expect(r.body).toMatchObject({ con_faltantes: 0, puede_prepararse: true });
    expect(r.body.ingredientes.every((i) => i.estado === "suficiente" && i.faltante === 0)).toBe(true);

    const confirmado = await planComidaService.confirmarPlan({ planId: ids.plan, usuarioId: ids.u });
    expect(confirmado.estado).toBe("confirmado");
  });

  test("un plan ya confirmado o cancelado no se compara (400)", async () => {
    for (const id of [ids.plan, ids.confirmado]) {
      const r = await get(`/api/planes-comida/${id}/faltantes`, "Almacen_Cocina");
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("El plan ya fue confirmado");
    }
    const c = await get(`/api/planes-comida/${ids.cancelado}/faltantes`, "Almacen_Cocina");
    expect(c.status).toBe(400);
    expect(c.body.error).toBe("El plan ya fue cancelado");
  });

  test("un menú sin ingredientes devuelve la lista vacía con advertencia", async () => {
    const r = await get(`/api/planes-comida/${ids.vacio}/faltantes`, "Almacen_Cocina");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ total_ingredientes: 0, puede_prepararse: false, ingredientes: [] });
    expect(r.body.advertencia).toMatch(/no tiene ingredientes/);
  });

  test("plan inexistente 404; id inválido 400", async () => {
    expect((await get("/api/planes-comida/2147483647/faltantes", "Almacen_Cocina")).status).toBe(404);
    expect((await get("/api/planes-comida/abc/faltantes", "Almacen_Cocina")).status).toBe(400);
  });

  test("Recepción no tiene acceso (403); sin token, 401", async () => {
    expect((await get(`/api/planes-comida/${ids.vacio}/faltantes`, "Recepcion")).status).toBe(403);
    expect((await get(`/api/planes-comida/${ids.vacio}/faltantes`, null)).status).toBe(401);
  });
});
