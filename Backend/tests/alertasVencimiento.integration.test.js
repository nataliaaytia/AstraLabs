const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const pool = require("../src/db/pool");
const { hoyLaPaz } = require("../src/utils/vencimiento");

jest.setTimeout(30000);

const SUF = Date.now();
const q = async (sql, params) => (await pool.query(sql, params)).rows;
let server;
let puerto;
let umbralOriginal;

const token = (rol) =>
  jwt.sign({ usuarioId: 1, rol }, process.env.JWT_SECRET, { expiresIn: "1h" });

function pedir(metodo, ruta, rol, cuerpo) {
  return new Promise((resolve, reject) => {
    const datos = cuerpo ? JSON.stringify(cuerpo) : null;
    const headers = {
      ...(rol ? { Authorization: `Bearer ${token(rol)}` } : {}),
      ...(datos
        ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(datos),
          }
        : {}),
    };
    const req = http.request(
      { host: "127.0.0.1", port: puerto, path: ruta, method: metodo, headers },
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
    req.end(datos || undefined);
  });
}

/** Fecha de hoy (La Paz) + n días, en YYYY-MM-DD. */
const enDias = (n) => {
  const [a, m, d] = hoyLaPaz().split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};

async function limpiar() {
  await q(
    `DELETE FROM lotes WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre LIKE 'ZZA-%')`,
  );
  await q(`DELETE FROM articulos WHERE nombre LIKE 'ZZA-%'`);
}

/** Solo los lotes de esta prueba (la BD real puede tener otros). */
const mios = (r) => r.body.lotes.filter((l) => l.articulo.startsWith("ZZA-"));
const corto = (l) => l.articulo.replace("ZZA-", "").replace(`-${SUF}`, "");
const porNombre = (r) => mios(r).map(corto).sort();

describe("HU-10 — alerta de lotes próximos a vencer (integración, Neon)", () => {
  beforeAll(async () => {
    await limpiar();
    umbralOriginal = (
      await q(
        `SELECT valor FROM configuracion WHERE clave = 'dias_anticipacion_vencimiento'`,
      )
    )[0]?.valor;
    await q(
      `INSERT INTO configuracion (clave, valor, descripcion) VALUES ('dias_anticipacion_vencimiento', '7', 'x')
       ON CONFLICT (clave) DO UPDATE SET valor = '7'`,
    );

    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    puerto = server.address().port;

    const cat = (await q("SELECT id FROM categorias ORDER BY id LIMIT 1"))[0]
      .id;
    const lote = async (nombre, vence, disponible) => {
      const a = (
        await q(
          `INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo)
           VALUES ($1, $2, 'kg', TRUE, 0) RETURNING id`,
          [`ZZA-${nombre}-${SUF}`, cat],
        )
      )[0].id;
      await q(
        `INSERT INTO lotes (articulo_id, numero_lote, fecha_vencimiento, cantidad_inicial, cantidad_disponible)
         VALUES ($1, $2, $3, 10, $4)`,
        [a, `ZZA-${nombre}`, vence, disponible],
      );
    };
    await lote("vencido3", enDias(-3), 10);
    await lote("hoy", enDias(0), 10);
    await lote("en5", enDias(5), 10);
    await lote("en7", enDias(7), 10);
    await lote("en8", enDias(8), 10);
    await lote("en30", enDias(30), 10);
    await lote("sinfecha", null, 10);
    await lote("sinstock", enDias(2), 0);
  });

  afterAll(async () => {
    if (umbralOriginal !== undefined) {
      await q(
        `UPDATE configuracion SET valor = $1 WHERE clave = 'dias_anticipacion_vencimiento'`,
        [umbralOriginal],
      );
    }
    await new Promise((resolve) => server.close(resolve));
    await limpiar();
    await pool.end();
  });

  test("con umbral 7: alerta los vencidos con stock y los que vencen en 7 días o menos", async () => {
    const r = await pedir("GET", "/api/alertas/vencimiento", "Administradora");
    expect(r.status).toBe(200);
    expect(r.body.dias_anticipacion).toBe(7);
    expect(porNombre(r)).toEqual(["en5", "en7", "hoy", "vencido3"]);
  });

  test("cada alerta trae lote, artículo, fecha, días restantes y estado", async () => {
    const r = await pedir("GET", "/api/alertas/vencimiento", "Administradora");
    const por = Object.fromEntries(mios(r).map((l) => [corto(l), l]));
    expect(por.vencido3).toMatchObject({
      estado: "vencido",
      dias_restantes: -3,
      fecha_vencimiento: enDias(-3),
      numero_lote: "ZZA-vencido3",
      cantidad_disponible: 10,
    });
    expect(por.hoy).toMatchObject({ estado: "por_vencer", dias_restantes: 0 });
    expect(por.en7).toMatchObject({ estado: "por_vencer", dias_restantes: 7 });
    expect(r.body.total).toBe(r.body.vencidos + r.body.por_vencer);
  });

  test("están ordenados del que vence antes al que vence después", async () => {
    const r = await pedir("GET", "/api/alertas/vencimiento", "Administradora");
    const fechas = r.body.lotes.map((l) => l.fecha_vencimiento);
    expect(fechas).toEqual([...fechas].sort());
  });

  test("el umbral es configurable: al subirlo a 10 aparece el lote que vence en 8 días", async () => {
    const put = await pedir(
      "PUT",
      "/api/alertas/vencimiento/umbral",
      "Administradora",
      { dias: 10 },
    );
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ dias: 10 });
    expect(
      (await pedir("GET", "/api/alertas/vencimiento/umbral", "Administradora"))
        .body,
    ).toEqual({ dias: 10 });

    const r = await pedir("GET", "/api/alertas/vencimiento", "Administradora");
    expect(r.body.dias_anticipacion).toBe(10);
    expect(porNombre(r)).toEqual(["en5", "en7", "en8", "hoy", "vencido3"]);
  });

  test("al bajarlo a 1 solo quedan los vencidos y los que vencen hoy o mañana", async () => {
    await pedir("PUT", "/api/alertas/vencimiento/umbral", "Administradora", {
      dias: 1,
    });
    const r = await pedir("GET", "/api/alertas/vencimiento", "Administradora");
    expect(porNombre(r)).toEqual(["hoy", "vencido3"]);
  });

  test("?dias=30 sirve para una consulta puntual sin cambiar el umbral guardado", async () => {
    const r = await pedir(
      "GET",
      "/api/alertas/vencimiento?dias=30",
      "Administradora",
    );
    expect(r.body.dias_anticipacion).toBe(30);
    expect(porNombre(r)).toEqual([
      "en30",
      "en5",
      "en7",
      "en8",
      "hoy",
      "vencido3",
    ]);
    expect(
      (await pedir("GET", "/api/alertas/vencimiento/umbral", "Administradora"))
        .body,
    ).toEqual({ dias: 1 });
  });

  test("valida el umbral y no lo modifica si es inválido", async () => {
    for (const dias of [0, -5, 366, 2.5, "abc", null]) {
      expect(
        (
          await pedir(
            "PUT",
            "/api/alertas/vencimiento/umbral",
            "Administradora",
            { dias },
          )
        ).status,
      ).toBe(400);
    }
    expect(
      (
        await pedir(
          "PUT",
          "/api/alertas/vencimiento/umbral",
          "Administradora",
          {},
        )
      ).status,
    ).toBe(400);
    expect(
      (await pedir("GET", "/api/alertas/vencimiento?dias=0", "Administradora"))
        .status,
    ).toBe(400);
    expect(
      (await pedir("GET", "/api/alertas/vencimiento/umbral", "Administradora"))
        .body,
    ).toEqual({ dias: 1 });
  });

  test("solo la Administradora; sin token, 401", async () => {
    for (const rol of ["Recepcion", "Almacen_Cocina"]) {
      expect((await pedir("GET", "/api/alertas/vencimiento", rol)).status).toBe(
        403,
      );
      expect(
        (await pedir("GET", "/api/alertas/vencimiento/umbral", rol)).status,
      ).toBe(403);
      expect(
        (
          await pedir("PUT", "/api/alertas/vencimiento/umbral", rol, {
            dias: 3,
          })
        ).status,
      ).toBe(403);
    }
    expect((await pedir("GET", "/api/alertas/vencimiento", null)).status).toBe(
      401,
    );
    expect(
      (await pedir("GET", "/api/alertas/vencimiento/umbral", "Administradora"))
        .body,
    ).toEqual({ dias: 1 });
  });
});
