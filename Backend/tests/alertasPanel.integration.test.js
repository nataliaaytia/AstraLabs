const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const pool = require("../src/db/pool");
const alertaService = require("../src/services/alertaService");
const entradaService = require("../src/services/entradaService");
const { hoyLaPaz } = require("../src/utils/vencimiento");

jest.setTimeout(30000);

const SUF = Date.now();
const q = async (sql, params) => (await pool.query(sql, params)).rows;
const ids = {};
let server;
let puerto;

const token = (rol, usuarioId = ids.u) => jwt.sign({ usuarioId, rol }, process.env.JWT_SECRET, { expiresIn: "1h" });

function pedir(metodo, ruta, rol) {
  return new Promise((resolve, reject) => {
    const headers = rol ? { Authorization: `Bearer ${token(rol)}` } : {};
    const req = http.request({ host: "127.0.0.1", port: puerto, path: ruta, method: metodo, headers }, (res) => {
      const partes = [];
      res.on("data", (p) => partes.push(p));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(partes).toString() || "{}") }));
    });
    req.on("error", reject);
    req.end();
  });
}

const enDias = (n) => {
  const [a, m, d] = hoyLaPaz().split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};

async function limpiar() {
  const arts = `SELECT id FROM articulos WHERE nombre LIKE 'ZZP-%'`;
  await q(`DELETE FROM alertas WHERE articulo_id IN (${arts})`);
  await q(`DELETE FROM movimiento_lotes WHERE lote_id IN (SELECT id FROM lotes WHERE articulo_id IN (${arts}))`);
  await q(`DELETE FROM movimientos WHERE articulo_id IN (${arts})`);
  await q(`DELETE FROM lotes WHERE articulo_id IN (${arts})`);
  await q(`DELETE FROM articulos WHERE nombre LIKE 'ZZP-%'`);
  await q(`DELETE FROM usuarios WHERE email LIKE 'zzp-%@test.local'`);
}

/** Solo en los artículos de esta prueba, para no tocar los de otras suites. */
const sincronizar = () => alertaService.sincronizarAlertas({ articuloIds: [ids.venc, ids.stock, ids.ok] });
/** Panel solo con las alertas de esta prueba (sin sincronizar: ya lo hicimos acotado). */
const panel = async (extra = "") => {
  const r = await pedir("GET", `/api/alertas?q=ZZP-&limite=500&sincronizar=false${extra}`, "Administradora");
  expect(r.status).toBe(200);
  return r.body;
};
const del = (body, tipo) => body.alertas.filter((a) => a.tipo === tipo);

describe("HU-12 — panel de alertas activas (integración, Neon)", () => {
  beforeAll(async () => {
    await limpiar();
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    puerto = server.address().port;

    const rol = (await q("SELECT id FROM roles WHERE nombre = 'Administradora'"))[0].id;
    ids.u = (
      await q(`INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ($1,$2,'x',$3) RETURNING id`,
        [`ZZP Admin ${SUF}`, `zzp-1-${SUF}@test.local`, rol])
    )[0].id;
    const cat = (await q("SELECT id FROM categorias ORDER BY id LIMIT 1"))[0].id;

    const articulo = async (nombre, minimo, perecedero) =>
      (
        await q(
          `INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo)
           VALUES ($1,$2,'kg',$3,$4) RETURNING id`,
          [`ZZP-${nombre}-${SUF}`, cat, perecedero, minimo],
        )
      )[0].id;
    const lote = (articuloId, vence, cantidad, numero) =>
      q(`INSERT INTO lotes (articulo_id, numero_lote, fecha_vencimiento, cantidad_inicial, cantidad_disponible)
         VALUES ($1,$2,$3,$4,$4)`, [articuloId, numero, vence, cantidad]);

    ids.venc = await articulo("venc", 0, true); // lote que vence en 3 días
    await lote(ids.venc, enDias(3), 10, "ZZP-L1");
    ids.stock = await articulo("stock", 10, false); // stock 4 <= mínimo 10
    await lote(ids.stock, null, 4, null);
    ids.ok = await articulo("ok", 10, true); // todo en orden
    await lote(ids.ok, enDias(100), 50, "ZZP-L2");
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await limpiar();
    await pool.end();
  });

  test("genera una alerta pendiente por cada situación y ninguna para el artículo sano", async () => {
    const r = await sincronizar();
    expect(r.creadas).toBe(2);
    const p = await panel();
    expect(p).toMatchObject({ total: 2, pendientes: 2, atendidas: 0 });
    expect(p.alertas.map((a) => a.articulo.replace("ZZP-", "").replace(`-${SUF}`, "")).sort()).toEqual(["stock", "venc"]);
    expect(p.alertas.every((a) => a.estado === "pendiente" && a.fecha_generada && a.fecha_atendida === null && a.atendida_por === null)).toBe(true);
  });

  test("cada alerta trae un mensaje legible y los datos del artículo o lote", async () => {
    const p = await panel();
    const v = del(p, "vencimiento")[0];
    expect(v).toMatchObject({ numero_lote: "ZZP-L1", fecha_vencimiento: enDias(3), dias_restantes: 3, stock_actual: 10 });
    expect(v.mensaje).toMatch(/lote ZZP-L1 vence en 3 días/);
    const s = del(p, "stock_minimo")[0];
    expect(s).toMatchObject({ stock_actual: 4, stock_minimo: 10, lote_id: null });
    expect(s.mensaje).toMatch(/stock 4 kg, mínimo 10 kg/);
  });

  test("sincronizar de nuevo no duplica alertas", async () => {
    expect((await sincronizar()).creadas).toBe(0);
    expect((await panel()).total).toBe(2);
  });

  test("la Administradora atiende una alerta: queda atendida con quién y cuándo", async () => {
    const venc = del(await panel(), "vencimiento")[0];
    const r = await pedir("PATCH", `/api/alertas/${venc.id}/atender`, "Administradora");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ id: venc.id, estado: "atendida" });

    const ahora = del(await panel(), "vencimiento")[0];
    expect(ahora).toMatchObject({ estado: "atendida", atendida_por: `ZZP Admin ${SUF}` });
    expect(ahora.fecha_atendida).toBeTruthy();
  });

  test("atenderla otra vez da 409; una inexistente 404; un id inválido 400", async () => {
    const venc = del(await panel(), "vencimiento")[0];
    expect((await pedir("PATCH", `/api/alertas/${venc.id}/atender`, "Administradora")).status).toBe(409);
    expect((await pedir("PATCH", "/api/alertas/2147483647/atender", "Administradora")).status).toBe(404);
    expect((await pedir("PATCH", "/api/alertas/abc/atender", "Administradora")).status).toBe(400);
  });

  test("el panel muestra pendientes y atendidas, las pendientes primero, con totales", async () => {
    const p = await panel();
    expect(p).toMatchObject({ total: 2, pendientes: 1, atendidas: 1 });
    expect(p.alertas.map((a) => a.estado)).toEqual(["pendiente", "atendida"]);
  });

  test("una alerta atendida a mano no vuelve a crearse mientras siga la situación", async () => {
    expect((await sincronizar()).creadas).toBe(0);
    expect(del(await panel(), "vencimiento")).toHaveLength(1);
  });

  test("filtros: por estado, por tipo y combinados", async () => {
    expect((await panel("&estado=pendiente")).alertas.map((a) => a.tipo)).toEqual(["stock_minimo"]);
    expect((await panel("&estado=atendida")).alertas.map((a) => a.tipo)).toEqual(["vencimiento"]);
    expect((await panel("&tipo=vencimiento")).alertas).toHaveLength(1);
    expect((await panel("&tipo=stock_minimo&estado=atendida")).alertas).toHaveLength(0);
    // los totales respetan tipo/búsqueda pero no el estado
    expect(await panel("&estado=pendiente")).toMatchObject({ pendientes: 1, atendidas: 1 });
  });

  test("filtros inválidos dan 400", async () => {
    for (const extra of ["&estado=x", "&tipo=x", "&limite=0", "&limite=501", "&limite=abc"]) {
      expect((await pedir("GET", `/api/alertas?sincronizar=false${extra}`, "Administradora")).status).toBe(400);
    }
  });

  test("si la situación se resuelve sola, la alerta pendiente se cierra automáticamente", async () => {
    await q(`UPDATE lotes SET cantidad_disponible = 50 WHERE articulo_id = $1`, [ids.stock]); // llegó stock
    const r = await sincronizar();
    expect(r.resueltas).toBe(1);
    const s = del(await panel(), "stock_minimo")[0];
    expect(s).toMatchObject({ estado: "atendida", atendida_por: null }); // cierre automático, sin usuario
    expect((await panel()).pendientes).toBe(0);
  });

  test("si el stock vuelve a bajar, se genera una alerta nueva", async () => {
    await q(`UPDATE lotes SET cantidad_disponible = 3 WHERE articulo_id = $1`, [ids.stock]);
    expect((await sincronizar()).creadas).toBe(1);
    const p = await panel();
    expect(del(p, "stock_minimo").map((a) => a.estado)).toEqual(["pendiente", "atendida"]);
  });

  test("una alerta de stock atendida a mano se vuelve a generar cuando llega una nueva entrada y sigue bajo el mínimo", async () => {
    const pendiente = del(await panel(), "stock_minimo").find((a) => a.estado === "pendiente");
    expect((await pedir("PATCH", `/api/alertas/${pendiente.id}/atender`, "Administradora")).status).toBe(200);

    expect((await sincronizar()).creadas).toBe(0); // sigue bajo el mínimo, pero ya la atendió y no hubo reposición

    await entradaService.registrarEntrada({ articuloId: ids.stock, cantidad: 1, usuarioId: ids.u }); // llegó 1 kg: 4 < 10
    expect((await sincronizar()).creadas).toBe(1);
    expect(del(await panel(), "stock_minimo").filter((a) => a.estado === "pendiente")).toHaveLength(1);
  });

  test("solo la Administradora; sin token, 401", async () => {
    for (const rol of ["Recepcion", "Almacen_Cocina"]) {
      expect((await pedir("GET", "/api/alertas?sincronizar=false", rol)).status).toBe(403);
      expect((await pedir("PATCH", "/api/alertas/1/atender", rol)).status).toBe(403);
      expect((await pedir("POST", "/api/alertas/sincronizar", rol)).status).toBe(403);
    }
    expect((await pedir("GET", "/api/alertas?sincronizar=false", null)).status).toBe(401);
  });
});
