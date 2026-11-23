const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const pool = require("../src/db/pool");
const salidaService = require("../src/services/salidaService");
const catalogoService = require("../src/services/catalogoService");

jest.setTimeout(30000);

const SUF = Date.now();
const q = async (sql, params) => (await pool.query(sql, params)).rows;
const ids = {};
let server;
let puerto;

const token = (rol) => jwt.sign({ usuarioId: 1, rol }, process.env.JWT_SECRET, { expiresIn: "1h" });

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
  await q(`DELETE FROM movimiento_lotes WHERE lote_id IN (
             SELECT l.id FROM lotes l JOIN articulos a ON a.id = l.articulo_id WHERE a.nombre LIKE 'ZZS-%')`);
  await q(`DELETE FROM movimientos WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZS-%')`);
  await q(`DELETE FROM lotes WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZS-%')`);
  await q(`DELETE FROM articulos WHERE nombre LIKE 'ZZS-%'`);
  await q(`DELETE FROM usuarios WHERE email LIKE 'zzs-%@test.local'`);
}

const corto = (a) => a.articulo.replace("ZZS-", "").replace(`-${SUF}`, "");
/** Alertas de esta prueba: nombre -> estado (la BD real puede tener otras). */
async function alertas() {
  const r = await get("/api/alertas/stock-minimo", "Administradora");
  expect(r.status).toBe(200);
  const mios = r.body.articulos.filter((a) => a.articulo.startsWith("ZZS-"));
  return { r, mios, mapa: Object.fromEntries(mios.map((a) => [corto(a), a.estado])) };
}

describe("HU-11 — alerta cuando un artículo llega a su stock mínimo (integración, Neon)", () => {
  beforeAll(async () => {
    await limpiar();
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    puerto = server.address().port;

    const rol = (await q("SELECT id FROM roles WHERE nombre = 'Almacen_Cocina'"))[0].id;
    ids.u = (
      await q(`INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ($1,$2,'x',$3) RETURNING id`,
        [`ZZS Almacen ${SUF}`, `zzs-1-${SUF}@test.local`, rol])
    )[0].id;
    const cat = (await q("SELECT id FROM categorias ORDER BY id LIMIT 1"))[0].id;

    const articulo = async (nombre, minimo, stock, activo = true) => {
      const id = (
        await q(
          `INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo, activo)
           VALUES ($1,$2,'kg',FALSE,$3,$4) RETURNING id`,
          [`ZZS-${nombre}-${SUF}`, cat, minimo, activo],
        )
      )[0].id;
      if (stock > 0) {
        await q(`INSERT INTO lotes (articulo_id, cantidad_inicial, cantidad_disponible) VALUES ($1,$2,$2)`, [id, stock]);
      }
      return id;
    };
    ids.sobra = await articulo("sobra", 10, 20);
    ids.justo = await articulo("justo", 10, 10);
    ids.bajo = await articulo("bajo", 10, 4);
    ids.agotado = await articulo("agotado", 5, 0);
    ids.sinminimo = await articulo("sinminimo", 0, 0);
    ids.inactivo = await articulo("inactivo", 10, 1, false);
    ids.flujo = await articulo("flujo", 10, 15);
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await limpiar();
    await pool.end();
  });

  test("alerta los artículos con stock igual o menor al mínimo; ignora los demás", async () => {
    const { mapa } = await alertas();
    expect(mapa).toEqual({ justo: "en_minimo", bajo: "bajo_minimo", agotado: "agotado" });
    // sobra (20>10), sinminimo (mínimo 0), inactivo y flujo (15>10) no aparecen
  });

  test("cada alerta trae artículo, categoría, stock, mínimo, faltante y % cubierto", async () => {
    const { mios } = await alertas();
    const por = Object.fromEntries(mios.map((a) => [corto(a), a]));
    expect(por.bajo).toMatchObject({ stock_actual: 4, stock_minimo: 10, faltante: 6, porcentaje_cubierto: 40, unidad_medida: "kg" });
    expect(por.justo).toMatchObject({ stock_actual: 10, faltante: 0, porcentaje_cubierto: 100 });
    expect(por.agotado).toMatchObject({ stock_actual: 0, stock_minimo: 5, faltante: 5, porcentaje_cubierto: 0 });
    expect(por.bajo.categoria).toBeTruthy();
  });

  test("los más críticos salen primero", async () => {
    const { mios } = await alertas();
    expect(mios.map(corto)).toEqual(["agotado", "bajo", "justo"]);
  });

  test("el resumen cuenta por estado", async () => {
    const { r } = await alertas();
    expect(r.body.total).toBe(r.body.agotados + r.body.bajo_minimo + r.body.en_minimo);
    expect(r.body.agotados).toBeGreaterThanOrEqual(1);
  });

  test("cuando una salida baja el stock al mínimo, se genera la alerta (y empeora si sigue bajando)", async () => {
    expect((await alertas()).mapa.flujo).toBeUndefined(); // 15 > 10

    await salidaService.registrarSalida({ articuloId: ids.flujo, cantidad: 5, usuarioId: ids.u, destino: "Prueba HU-11" });
    expect((await alertas()).mapa.flujo).toBe("en_minimo"); // 10 = 10

    await salidaService.registrarSalida({ articuloId: ids.flujo, cantidad: 3, usuarioId: ids.u, destino: "Prueba HU-11" });
    expect((await alertas()).mapa.flujo).toBe("bajo_minimo"); // 7 < 10

    await salidaService.registrarSalida({ articuloId: ids.flujo, cantidad: 7, usuarioId: ids.u, destino: "Prueba HU-11" });
    expect((await alertas()).mapa.flujo).toBe("agotado"); // 0
  });

  test("usa el stock mínimo editado (HU-07): subirlo hace aparecer la alerta", async () => {
    expect((await alertas()).mapa.sobra).toBeUndefined(); // 20 > 10
    await catalogoService.actualizarArticulo(ids.sobra, { stockMinimo: 25 });
    expect((await alertas()).mapa.sobra).toBe("bajo_minimo"); // 20 < 25
    await catalogoService.actualizarArticulo(ids.sobra, { stockMinimo: 20 });
    expect((await alertas()).mapa.sobra).toBe("en_minimo"); // 20 = 20
  });

  test("el resumen del panel incluye ambas alertas", async () => {
    const r = await get("/api/alertas/resumen", "Administradora");
    expect(r.status).toBe(200);
    expect(r.body.vencimiento).toEqual(expect.objectContaining({ dias_anticipacion: expect.any(Number), total: expect.any(Number) }));
    expect(r.body.stock_minimo.total).toBeGreaterThanOrEqual(3);
    expect(r.body.total).toBe(r.body.vencimiento.total + r.body.stock_minimo.total);
  });

  test("solo la Administradora; sin token, 401", async () => {
    for (const ruta of ["/api/alertas/stock-minimo", "/api/alertas/resumen"]) {
      expect((await get(ruta, "Recepcion")).status).toBe(403);
      expect((await get(ruta, "Almacen_Cocina")).status).toBe(403);
      expect((await get(ruta, null)).status).toBe(401);
    }
  });
});
