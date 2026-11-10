const pool = require("../db/pool");
const planComidaService = require("./planComidaService");

const EMAIL_USUARIO_TEST = "test-hu17@astralabs.test";
const NOMBRE_MENU_TEST = "Menu Test HU-17";
const FECHA_TEST = "2099-01-15"; // fecha lejana para no chocar con datos reales

let usuarioId; // compartido entre los dos describes de este archivo

describe("Plan de Comidas — integración real (RF-17)", () => {
  let menuId;
  let planId;

  beforeAll(async () => {
    // Orden de dependencias: primero los planes (pueden referenciar movimientos
    // vía movimiento_salida_id si quedó un plan confirmado de una corrida anterior),
    // luego los movimientos/lotes, y recién al final usuarios/menus.
    await pool.query(
      `DELETE FROM planes_comida WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = $1)`,
      [EMAIL_USUARIO_TEST],
    );
    await pool.query(
      `DELETE FROM movimiento_lotes WHERE movimiento_id IN (
         SELECT id FROM movimientos WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = $1)
       )`,
      [EMAIL_USUARIO_TEST],
    );
    await pool.query(
      `DELETE FROM movimientos WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = $1)`,
      [EMAIL_USUARIO_TEST],
    );
    await pool.query(`DELETE FROM usuarios WHERE email = $1`, [
      EMAIL_USUARIO_TEST,
    ]);
    await pool.query(`DELETE FROM menus WHERE nombre = $1`, [NOMBRE_MENU_TEST]);

    const rol = await pool.query(
      `SELECT id FROM roles WHERE nombre = 'Almacen_Cocina'`,
    );
    const usuario = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ($1, $2, 'x', $3) RETURNING id`,
      ["Usuario Test HU-17", EMAIL_USUARIO_TEST, rol.rows[0].id],
    );
    usuarioId = usuario.rows[0].id;

    const menu = await pool.query(
      `INSERT INTO menus (nombre, descripcion) VALUES ($1, 'menu de prueba') RETURNING id`,
      [NOMBRE_MENU_TEST],
    );
    menuId = menu.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM planes_comida WHERE fecha = $1`, [
      FECHA_TEST,
    ]);
    await pool.query(`DELETE FROM menus WHERE id = $1`, [menuId]);
  });

  test("registra un plan y queda disponible al listar por fecha", async () => {
    const plan = await planComidaService.registrarPlan({
      fecha: FECHA_TEST,
      tipoComida: "almuerzo",
      menuId,
      comensales: 25,
      usuarioId,
    });

    planId = plan.id;
    expect(plan.estado).toBe("planificado");

    const planes = await planComidaService.listarPlanes({ fecha: FECHA_TEST });
    const encontrado = planes.find((p) => p.id === planId);

    expect(encontrado).toBeDefined();
    expect(encontrado.tipo_comida).toBe("almuerzo");
    expect(encontrado.comensales).toBe(25);
    expect(encontrado.menu).toBe(NOMBRE_MENU_TEST);
  });

  test("rechaza un segundo plan para la misma fecha y tipo de comida", async () => {
    await expect(
      planComidaService.registrarPlan({
        fecha: FECHA_TEST,
        tipoComida: "almuerzo",
        menuId,
        comensales: 10,
        usuarioId,
      }),
    ).rejects.toThrow(
      "Ya existe un plan registrado para esa fecha y tipo de comida",
    );
  });

  test("rechaza un menú que no existe", async () => {
    await expect(
      planComidaService.registrarPlan({
        fecha: FECHA_TEST,
        tipoComida: "desayuno",
        menuId: 999999,
        comensales: 10,
        usuarioId,
      }),
    ).rejects.toThrow("El menú seleccionado no existe");
  });
});

describe("confirmarPlan — descuento automático de insumos (RF-19)", () => {
  const NOMBRE_ART_1 = "Articulo HU-19 Arroz";
  const NOMBRE_ART_2 = "Articulo HU-19 Aceite";
  let articulo1Id;
  let articulo2Id;
  let menuConIngredientesId;
  let planConfirmarId;

  beforeAll(async () => {
    await pool.query(
      `DELETE FROM movimiento_lotes WHERE lote_id IN (
         SELECT l.id FROM lotes l JOIN articulos a ON a.id = l.articulo_id WHERE a.nombre IN ($1, $2)
       )`,
      [NOMBRE_ART_1, NOMBRE_ART_2],
    );
    await pool.query(
      `DELETE FROM movimientos WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre IN ($1, $2))`,
      [NOMBRE_ART_1, NOMBRE_ART_2],
    );
    await pool.query(
      `DELETE FROM lotes WHERE articulo_id IN (SELECT id FROM articulos WHERE nombre IN ($1, $2))`,
      [NOMBRE_ART_1, NOMBRE_ART_2],
    );
    await pool.query(
      `DELETE FROM planes_comida WHERE menu_id IN (SELECT id FROM menus WHERE nombre = 'Menu HU-19')`,
    );
    await pool.query(
      `DELETE FROM menu_ingredientes WHERE menu_id IN (SELECT id FROM menus WHERE nombre = 'Menu HU-19')`,
    );
    await pool.query(`DELETE FROM articulos WHERE nombre IN ($1, $2)`, [
      NOMBRE_ART_1,
      NOMBRE_ART_2,
    ]);
    await pool.query(`DELETE FROM menus WHERE nombre = 'Menu HU-19'`);

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

    // stock inicial vía entrada (igual que en el resto de tests de integración)
    for (const [articuloId, cantidad] of [
      [articulo1Id, 50],
      [articulo2Id, 10],
    ]) {
      const entrada = await pool.query(
        `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id) VALUES ('entrada', $1, $2, $3) RETURNING id`,
        [articuloId, cantidad, usuarioId],
      );
      const lote = await pool.query(
        `INSERT INTO lotes (articulo_id, numero_lote, cantidad_inicial) VALUES ($1, 'LOTE-HU19', $2) RETURNING id`,
        [articuloId, cantidad],
      );
      await pool.query(
        `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad) VALUES ($1, $2, $3)`,
        [entrada.rows[0].id, lote.rows[0].id, cantidad],
      );
    }

    const menu = await pool.query(
      `INSERT INTO menus (nombre) VALUES ('Menu HU-19') RETURNING id`,
    );
    menuConIngredientesId = menu.rows[0].id;

    await pool.query(
      `INSERT INTO menu_ingredientes (menu_id, articulo_id, cantidad_por_porcion) VALUES ($1, $2, 0.2), ($1, $3, 0.05)`,
      [menuConIngredientesId, articulo1Id, articulo2Id],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM planes_comida WHERE menu_id = $1`, [
      menuConIngredientesId,
    ]);
    await pool.query(
      `DELETE FROM movimiento_lotes WHERE lote_id IN (SELECT id FROM lotes WHERE articulo_id IN ($1, $2))`,
      [articulo1Id, articulo2Id],
    );
    await pool.query(`DELETE FROM movimientos WHERE articulo_id IN ($1, $2)`, [
      articulo1Id,
      articulo2Id,
    ]);
    await pool.query(`DELETE FROM lotes WHERE articulo_id IN ($1, $2)`, [
      articulo1Id,
      articulo2Id,
    ]);
    await pool.query(`DELETE FROM menu_ingredientes WHERE menu_id = $1`, [
      menuConIngredientesId,
    ]);
    await pool.query(`DELETE FROM menus WHERE id = $1`, [
      menuConIngredientesId,
    ]);
    await pool.query(`DELETE FROM articulos WHERE id IN ($1, $2)`, [
      articulo1Id,
      articulo2Id,
    ]);
    await pool.query(`DELETE FROM usuarios WHERE id = $1`, [usuarioId]);
    await pool.end();
  });

  test("confirma el plan y descuenta cada ingrediente según comensales", async () => {
    const plan = await planComidaService.registrarPlan({
      fecha: "2099-02-20",
      tipoComida: "almuerzo",
      menuId: menuConIngredientesId,
      comensales: 20, // 20*0.2=4kg arroz, 20*0.05=1 litro aceite
      usuarioId,
    });
    planConfirmarId = plan.id;

    const confirmado = await planComidaService.confirmarPlan({
      planId: plan.id,
      usuarioId,
    });
    expect(confirmado.estado).toBe("confirmado");
    expect(confirmado.movimiento_salida_id).toBeDefined();

    const stock1 = await pool.query(
      `SELECT stock_actual FROM vw_stock_articulo WHERE articulo_id = $1`,
      [articulo1Id],
    );
    const stock2 = await pool.query(
      `SELECT stock_actual FROM vw_stock_articulo WHERE articulo_id = $1`,
      [articulo2Id],
    );

    expect(Number(stock1.rows[0].stock_actual)).toBe(46); // 50 - 4
    expect(Number(stock2.rows[0].stock_actual)).toBe(9); // 10 - 1

    const movimientos = await pool.query(
      `SELECT tipo, destino FROM movimientos WHERE destino = $1`,
      [`Plan de comidas #${plan.id} (almuerzo)`],
    );
    expect(movimientos.rows).toHaveLength(2);
    expect(movimientos.rows.every((m) => m.tipo === "salida")).toBe(true);
  });

  test("rechaza confirmar el mismo plan dos veces", async () => {
    await expect(
      planComidaService.confirmarPlan({ planId: planConfirmarId, usuarioId }),
    ).rejects.toThrow("El plan ya fue confirmado");
  });

  test("si falta stock de un ingrediente, no descuenta nada (atomicidad)", async () => {
    const plan = await planComidaService.registrarPlan({
      fecha: "2099-02-21",
      tipoComida: "desayuno",
      menuId: menuConIngredientesId,
      comensales: 10000, // imposible: pide muchísimo más de lo disponible
      usuarioId,
    });

    const stock1Antes = await pool.query(
      `SELECT stock_actual FROM vw_stock_articulo WHERE articulo_id = $1`,
      [articulo1Id],
    );

    await expect(
      planComidaService.confirmarPlan({ planId: plan.id, usuarioId }),
    ).rejects.toThrow("Stock insuficiente");

    const stock1Despues = await pool.query(
      `SELECT stock_actual FROM vw_stock_articulo WHERE articulo_id = $1`,
      [articulo1Id],
    );

    // El primer ingrediente (arroz, 10000*0.2=2000, alcanzaba con 46) no debió descontarse,
    // porque el segundo (aceite, 10000*0.05=500, solo hay 9) hizo fallar la transacción completa.
    expect(Number(stock1Despues.rows[0].stock_actual)).toBe(
      Number(stock1Antes.rows[0].stock_actual),
    );

    await pool.query(`DELETE FROM planes_comida WHERE id = $1`, [plan.id]);
  });
});
