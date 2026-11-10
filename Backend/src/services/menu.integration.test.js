const pool = require("../db/pool");
const menuService = require("./menuService");

const NOMBRE_ART_1 = "Articulo HU-16 Arroz";
const NOMBRE_ART_2 = "Articulo HU-16 Aceite";
const NOMBRE_MENU_TEST = "Menu Test HU-16";

describe("Menús — integración real (RF-16)", () => {
  let articulo1Id;
  let articulo2Id;
  let menuId;

  beforeAll(async () => {
    await pool.query(
      `DELETE FROM menu_ingredientes WHERE menu_id IN (SELECT id FROM menus WHERE nombre = $1)`,
      [NOMBRE_MENU_TEST],
    );
    await pool.query(
      `DELETE FROM planes_comida WHERE menu_id IN (SELECT id FROM menus WHERE nombre = $1)`,
      [NOMBRE_MENU_TEST],
    );
    await pool.query(`DELETE FROM menus WHERE nombre = $1`, [NOMBRE_MENU_TEST]);
    await pool.query(`DELETE FROM articulos WHERE nombre IN ($1, $2)`, [
      NOMBRE_ART_1,
      NOMBRE_ART_2,
    ]);

    const categoria = await pool.query(
      `SELECT id FROM categorias WHERE nombre = 'Alimentos'`,
    );

    const art1 = await pool.query(
      `INSERT INTO articulos (nombre, categoria_id, unidad_medida, stock_minimo) VALUES ($1, $2, 'kg', 1) RETURNING id`,
      [NOMBRE_ART_1, categoria.rows[0].id],
    );
    articulo1Id = art1.rows[0].id;

    const art2 = await pool.query(
      `INSERT INTO articulos (nombre, categoria_id, unidad_medida, stock_minimo) VALUES ($1, $2, 'litro', 1) RETURNING id`,
      [NOMBRE_ART_2, categoria.rows[0].id],
    );
    articulo2Id = art2.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM menu_ingredientes WHERE menu_id = $1`, [
      menuId,
    ]);
    await pool.query(`DELETE FROM menus WHERE id = $1`, [menuId]);
    await pool.query(`DELETE FROM articulos WHERE id IN ($1, $2)`, [
      articulo1Id,
      articulo2Id,
    ]);
    await pool.end();
  });

  test("registra un menú con dos ingredientes y queda disponible con el detalle completo", async () => {
    const menu = await menuService.registrarMenu({
      nombre: NOMBRE_MENU_TEST,
      descripcion: "menu de prueba HU-16",
      ingredientes: [
        { articuloId: articulo1Id, cantidadPorPorcion: 0.2 },
        { articuloId: articulo2Id, cantidadPorPorcion: 0.05 },
      ],
    });

    menuId = menu.id;
    expect(menu.nombre).toBe(NOMBRE_MENU_TEST);

    const detalle = await menuService.obtenerMenu(menuId);
    expect(detalle.ingredientes).toHaveLength(2);

    const ingArroz = detalle.ingredientes.find(
      (i) => i.articulo_id === articulo1Id,
    );
    expect(Number(ingArroz.cantidad_por_porcion)).toBe(0.2);
    expect(ingArroz.articulo).toBe(NOMBRE_ART_1);

    const menus = await menuService.listarMenus();
    expect(menus.some((m) => m.id === menuId)).toBe(true);
  });

  test("rechaza un artículo que no existe (CHECK de FK de respaldo)", async () => {
    await expect(
      menuService.registrarMenu({
        nombre: "Menu con articulo invalido HU-16",
        ingredientes: [{ articuloId: 999999, cantidadPorPorcion: 1 }],
      }),
    ).rejects.toThrow("Uno de los artículos seleccionados no existe");
  });
});
