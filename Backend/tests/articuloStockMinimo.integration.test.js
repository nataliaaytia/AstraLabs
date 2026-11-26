const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const pool = require("../src/db/pool");
const reporteService = require("../src/services/reporteService");
const catalogoService = require("../src/services/catalogoService");

jest.setTimeout(30000);

const SUF = Date.now();
const q = async (sql, params) => (await pool.query(sql, params)).rows;
let server;
let puerto;
let articuloId;

const token = (rol) =>
  jwt.sign({ usuarioId: 1, rol }, process.env.JWT_SECRET, { expiresIn: "1h" });

function enviar(metodo, ruta, rol, cuerpo) {
  return new Promise((resolve, reject) => {
    const datos = JSON.stringify(cuerpo);
    const req = http.request(
      {
        host: "127.0.0.1",
        port: puerto,
        path: ruta,
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(datos),
          ...(rol ? { Authorization: `Bearer ${token(rol)}` } : {}),
        },
      },
      (res) => {
        const partes = [];
        res.on("data", (p) => partes.push(p));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: JSON.parse(Buffer.concat(partes).toString() || "{}"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end(datos);
  });
}

const patch = (ruta, rol, cuerpo) => enviar("PATCH", ruta, rol, cuerpo);
const post = (ruta, rol, cuerpo) => enviar("POST", ruta, rol, cuerpo);

async function limpiar() {
  await q(`DELETE FROM movimiento_lotes WHERE lote_id IN (
             SELECT l.id FROM lotes l JOIN articulos a ON a.id = l.articulo_id WHERE a.nombre LIKE 'ZZN-%')`);
  await q(
    `DELETE FROM movimientos WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZN-%')`,
  );
  await q(
    `DELETE FROM lotes WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZN-%')`,
  );
  await q(`DELETE FROM articulos WHERE nombre LIKE 'ZZN-%'`);
}

const enNecesidades = async () =>
  (await reporteService.obtenerNecesidadesCriticas()).some(
    (n) => Number(n.articulo_id) === articuloId,
  );
const enBajoMinimo = async () =>
  (await catalogoService.listarArticulos({ bajoMinimo: true, q: "ZZN-" })).some(
    (a) => Number(a.id) === articuloId,
  );

describe("HU-07 — stock mínimo por artículo alimenta las alertas (integración, Neon)", () => {
  beforeAll(async () => {
    await limpiar();
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    puerto = server.address().port;

    const cat = (await q("SELECT id FROM categorias ORDER BY id LIMIT 1"))[0]
      .id;
    articuloId = (
      await q(
        `INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo)
         VALUES ($1, $2, 'kg', FALSE, 0) RETURNING id`,
        [`ZZN-Arroz-${SUF}`, cat],
      )
    )[0].id;
    // 10 kg disponibles
    await q(
      `INSERT INTO lotes (articulo_id, cantidad_inicial, cantidad_disponible) VALUES ($1, 10, 10)`,
      [articuloId],
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await limpiar();
    await pool.end();
  });

  test("sin stock mínimo no hay alerta", async () => {
    expect(await enNecesidades()).toBe(false);
    expect(await enBajoMinimo()).toBe(false);
  });

  test("al subir el mínimo por encima del stock, el artículo entra en las alertas", async () => {
    const r = await patch(`/api/articulos/${articuloId}`, "Administradora", {
      stockMinimo: 25,
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: articuloId, stock_minimo: 25 });

    expect(await enNecesidades()).toBe(true);
    expect(await enBajoMinimo()).toBe(true);
    const fila = (await reporteService.obtenerNecesidadesCriticas()).find(
      (n) => Number(n.articulo_id) === articuloId,
    );
    expect(Number(fila.stock_minimo)).toBe(25);
  });

  test("al bajar el mínimo por debajo del stock, sale de las alertas", async () => {
    const r = await patch(`/api/articulos/${articuloId}`, "Administradora", {
      stockMinimo: 5,
    });
    expect(r.status).toBe(200);
    expect(await enNecesidades()).toBe(false);
    expect(await enBajoMinimo()).toBe(false);
  });

  test("edita otros campos sin tocar el stock mínimo", async () => {
    const r = await patch(`/api/articulos/${articuloId}`, "Administradora", {
      unidadMedida: "lb",
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ unidad_medida: "lb", stock_minimo: 5 });
  });

  test("valida: valor negativo, vacío o artículo inexistente", async () => {
    expect(
      (
        await patch(`/api/articulos/${articuloId}`, "Administradora", {
          stockMinimo: -3,
        })
      ).status,
    ).toBe(400);
    expect(
      (await patch(`/api/articulos/${articuloId}`, "Administradora", {}))
        .status,
    ).toBe(400);
    expect(
      (
        await patch(`/api/articulos/2147483647`, "Administradora", {
          stockMinimo: 1,
        })
      ).status,
    ).toBe(404);
    const sigue = (
      await q(`SELECT stock_minimo FROM articulos WHERE id = $1`, [articuloId])
    )[0];
    expect(Number(sigue.stock_minimo)).toBe(5);
  });

  test("solo la Administradora puede editar; sin token, 401", async () => {
    expect(
      (
        await patch(`/api/articulos/${articuloId}`, "Recepcion", {
          stockMinimo: 99,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await patch(`/api/articulos/${articuloId}`, "Almacen_Cocina", {
          stockMinimo: 99,
        })
      ).status,
    ).toBe(403);
    expect(
      (await patch(`/api/articulos/${articuloId}`, null, { stockMinimo: 99 }))
        .status,
    ).toBe(401);
    const sigue = (
      await q(`SELECT stock_minimo FROM articulos WHERE id = $1`, [articuloId])
    )[0];
    expect(Number(sigue.stock_minimo)).toBe(5);
  });

  test("crear artículos (POST) también es solo de la Administradora", async () => {
    const cat = (await q("SELECT id FROM categorias ORDER BY id LIMIT 1"))[0]
      .id;
    const nuevo = (n) => ({
      nombre: `ZZN-Nuevo-${n}-${SUF}`,
      categoriaId: cat,
      unidadMedida: "kg",
      stockMinimo: 3,
    });

    expect((await post("/api/articulos", "Recepcion", nuevo("r"))).status).toBe(
      403,
    );
    expect(
      (await post("/api/articulos", "Almacen_Cocina", nuevo("a"))).status,
    ).toBe(403);
    expect((await post("/api/articulos", null, nuevo("s"))).status).toBe(401);
    expect(
      await q(`SELECT id FROM articulos WHERE nombre LIKE $1`, [
        `ZZN-Nuevo-%-${SUF}`,
      ]),
    ).toHaveLength(0);

    const ok = await post("/api/articulos", "Administradora", nuevo("ok"));
    expect(ok.status).toBe(201);
    expect(Number(ok.body.stock_minimo)).toBe(3);
  });
});
