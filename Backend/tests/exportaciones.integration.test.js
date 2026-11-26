const http = require("http");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");
const app = require("../src/app");
const pool = require("../src/db/pool");

jest.setTimeout(30000);

const SUF = Date.now();
let server;
let puerto;
let articuloId;

const token = (rol) =>
  jwt.sign({ usuarioId: 1, rol }, process.env.JWT_SECRET, { expiresIn: "1h" });

function pedir(ruta, rol) {
  return new Promise((resolve, reject) => {
    const headers = rol ? { Authorization: `Bearer ${token(rol)}` } : {};
    http
      .get({ host: "127.0.0.1", port: puerto, path: ruta, headers }, (res) => {
        const partes = [];
        res.on("data", (p) => partes.push(p));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(partes),
          }),
        );
      })
      .on("error", reject);
  });
}

async function primeraColumna(body) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(body);
  const valores = [];
  wb.worksheets[0].eachRow((row, n) => {
    if (n > 6) valores.push(row.getCell(1).value);
  });
  return valores;
}

describe("Exportaciones RF-24 (integración, Neon)", () => {
  beforeAll(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    puerto = server.address().port;

    const { rows: cat } = await pool.query(
      "SELECT id FROM categorias ORDER BY id LIMIT 1",
    );
    const { rows } = await pool.query(
      `INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo)
       VALUES ($1, $2, 'kg', FALSE, 1) RETURNING id`,
      [`ZZX-Exportar-${SUF}`, cat[0].id],
    );
    articuloId = rows[0].id;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM articulos WHERE id = $1", [articuloId]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  describe("autenticación y formato", () => {
    test("sin token → 401", async () => {
      const r = await pedir("/api/articulos/exportar?formato=xlsx");
      expect(r.status).toBe(401);
    });

    test("formato faltante o inválido → 400", async () => {
      const a = await pedir("/api/articulos/exportar", "Recepcion");
      expect(a.status).toBe(400);
      expect(JSON.parse(a.body).error).toMatch(/formato debe ser/);
      const b = await pedir("/api/articulos/exportar?formato=csv", "Recepcion");
      expect(b.status).toBe(400);
    });
  });

  describe("artículos (cualquier rol)", () => {
    test("Excel: descarga y respeta el filtro q", async () => {
      const r = await pedir(
        `/api/articulos/exportar?formato=xlsx&q=ZZX-Exportar-${SUF}`,
        "Recepcion",
      );
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toMatch(/spreadsheetml/);
      expect(r.headers["content-disposition"]).toMatch(
        /attachment; filename="articulos_\d{4}-\d{2}-\d{2}\.xlsx"/,
      );
      expect(r.body.subarray(0, 2).toString()).toBe("PK");
      expect(await primeraColumna(r.body)).toEqual([`ZZX-Exportar-${SUF}`]);
    });

    test("PDF: descarga", async () => {
      const r = await pedir(
        `/api/articulos/exportar?formato=pdf&q=ZZX-Exportar-${SUF}`,
        "Almacen_Cocina",
      );
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toBe("application/pdf");
      expect(r.body.subarray(0, 5).toString()).toBe("%PDF-");
    });

    test("categoria_id inválida → 400", async () => {
      const r = await pedir(
        "/api/articulos/exportar?formato=xlsx&categoria_id=abc",
        "Recepcion",
      );
      expect(r.status).toBe(400);
    });
  });

  describe("menús (Administradora y Almacen_Cocina)", () => {
    test("Recepcion → 403", async () => {
      const r = await pedir("/api/menus/exportar?formato=xlsx", "Recepcion");
      expect(r.status).toBe(403);
    });
    test("Almacen_Cocina → 200 y no lo confunde con /api/menus/:id", async () => {
      const r = await pedir("/api/menus/exportar?formato=pdf", "Almacen_Cocina");
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toBe("application/pdf");
    });
  });

  describe("planes de comida (Administradora y Almacen_Cocina)", () => {
    test("Recepcion → 403", async () => {
      const r = await pedir("/api/planes-comida/exportar?formato=xlsx&mes=2099-03", "Recepcion");
      expect(r.status).toBe(403);
    });
    test("Almacen_Cocina con mes → 200 (aunque el mes esté vacío)", async () => {
      const r = await pedir("/api/planes-comida/exportar?formato=xlsx&mes=2099-03", "Almacen_Cocina");
      expect(r.status).toBe(200);
      expect(r.headers["content-disposition"]).toMatch(/plan_comidas_/);
    });
    test("mes inválido, o mes + desde → 400", async () => {
      const a = await pedir("/api/planes-comida/exportar?formato=xlsx&mes=2099-13", "Administradora");
      expect(a.status).toBe(400);
      const b = await pedir("/api/planes-comida/exportar?formato=xlsx&mes=2099-03&desde=2099-03-05", "Administradora");
      expect(b.status).toBe(400);
    });
  });

  describe("reporte de necesidades críticas (solo Administradora)", () => {
    test("Almacen_Cocina → 403", async () => {
      const r = await pedir("/api/reportes/necesidades-criticas/exportar?formato=xlsx", "Almacen_Cocina");
      expect(r.status).toBe(403);
    });
    test("Administradora → 200 en Excel y PDF", async () => {
      const x = await pedir("/api/reportes/necesidades-criticas/exportar?formato=xlsx&limite=5", "Administradora");
      expect(x.status).toBe(200);
      const p = await pedir("/api/reportes/necesidades-criticas/exportar?formato=pdf", "Administradora");
      expect(p.status).toBe(200);
      expect(p.body.subarray(0, 5).toString()).toBe("%PDF-");
    });
    test("limite inválido → 400", async () => {
      const r = await pedir("/api/reportes/necesidades-criticas/exportar?formato=xlsx&limite=0", "Administradora");
      expect(r.status).toBe(400);
    });
  });
});
