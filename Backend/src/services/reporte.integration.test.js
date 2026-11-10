const pool = require("../db/pool");
const reporteService = require("./reporteService");

const NOMBRE_ARTICULO_CRITICO = "Articulo Test HU-21 Critico";
const NOMBRE_ARTICULO_OK = "Articulo Test HU-21 OK";

describe("Reportes — integración real (RF-21)", () => {
  let articuloCriticoId;
  let articuloOkId;

  beforeAll(async () => {
    await pool.query(`DELETE FROM articulos WHERE nombre IN ($1, $2)`, [
      NOMBRE_ARTICULO_CRITICO,
      NOMBRE_ARTICULO_OK,
    ]);

    const categoria = await pool.query(
      `SELECT id FROM categorias WHERE nombre = 'Alimentos'`,
    );

    // Sin lotes -> stock_actual = 0, bajo el mínimo (20) -> debe salir como crítico.
    const critico = await pool.query(
      `INSERT INTO articulos (nombre, categoria_id, unidad_medida, stock_minimo) VALUES ($1, $2, 'kg', 20) RETURNING id`,
      [NOMBRE_ARTICULO_CRITICO, categoria.rows[0].id],
    );
    articuloCriticoId = critico.rows[0].id;

    // Sin mínimo definido -> nunca debe aparecer como crítico.
    const ok = await pool.query(
      `INSERT INTO articulos (nombre, categoria_id, unidad_medida, stock_minimo) VALUES ($1, $2, 'kg', 0) RETURNING id`,
      [NOMBRE_ARTICULO_OK, categoria.rows[0].id],
    );
    articuloOkId = ok.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM articulos WHERE id IN ($1, $2)`, [
      articuloCriticoId,
      articuloOkId,
    ]);
    await pool.end();
  });

  test("incluye el artículo sin stock por debajo de su mínimo, con el déficit correcto", async () => {
    const resultado = await reporteService.obtenerNecesidadesCriticas({});
    const encontrado = resultado.find(
      (a) => a.articulo_id === articuloCriticoId,
    );

    expect(encontrado).toBeDefined();
    expect(encontrado.stock_actual).toBe(0);
    expect(encontrado.deficit).toBe(20);
    expect(encontrado.porcentaje_cubierto).toBe(0);
  });

  test("no incluye artículos sin stock_minimo configurado", async () => {
    const resultado = await reporteService.obtenerNecesidadesCriticas({});
    const encontrado = resultado.find((a) => a.articulo_id === articuloOkId);

    expect(encontrado).toBeUndefined();
  });

  test("respeta el límite solicitado", async () => {
    const resultado = await reporteService.obtenerNecesidadesCriticas({
      limite: 1,
    });
    expect(resultado.length).toBeLessThanOrEqual(1);
  });
});
