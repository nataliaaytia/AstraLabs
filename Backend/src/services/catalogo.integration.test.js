const pool = require("../db/pool");
const catalogoService = require("./catalogoService");

describe("Catálogo — integración real (RF-01, RF-07)", () => {
  afterAll(async () => {
    await pool.end();
  });

  test("lista las categorías sembradas", async () => {
    const categorias = await catalogoService.listarCategorias();
    const nombres = categorias.map((c) => c.nombre);

    expect(nombres).toEqual(
      expect.arrayContaining([
        "Alimentos",
        "Medicinas",
        "Ropa",
        "Mobiliario/Otros",
      ]),
    );
  });

  test("lista artículos filtrados por categoría, con stock_actual calculado", async () => {
    const { rows } = await pool.query(
      `SELECT id FROM categorias WHERE nombre = 'Alimentos'`,
    );
    const categoriaId = rows[0].id;

    const articulos = await catalogoService.listarArticulos({ categoriaId });

    const nombres = articulos.map((a) => a.nombre);
    expect(nombres).toEqual(
      expect.arrayContaining(["Arroz", "Leche en polvo"]),
    );

    const arroz = articulos.find((a) => a.nombre === "Arroz");
    expect(Number(arroz.stock_actual)).toBeGreaterThan(0);
    expect(arroz.categoria).toBe("Alimentos");

    // No debe traer artículos de otras categorías
    expect(nombres).not.toContain("Paracetamol");
  });

  test("sin filtro, devuelve artículos de todas las categorías", async () => {
    const articulos = await catalogoService.listarArticulos({});
    const categorias = new Set(articulos.map((a) => a.categoria));

    expect(categorias.size).toBeGreaterThan(1);
  });
});
