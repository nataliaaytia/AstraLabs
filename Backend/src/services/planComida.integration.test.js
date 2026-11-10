const pool = require("../db/pool");
const planComidaService = require("./planComidaService");

const EMAIL_USUARIO_TEST = "test-hu17@astralabs.test";
const NOMBRE_MENU_TEST = "Menu Test HU-17";
const FECHA_TEST = "2099-01-15"; // fecha lejana para no chocar con datos reales

describe("Plan de Comidas — integración real (RF-17)", () => {
  let usuarioId;
  let menuId;
  let planId;

  beforeAll(async () => {
    await pool.query(`DELETE FROM planes_comida WHERE fecha = $1`, [
      FECHA_TEST,
    ]);
    await pool.query(`DELETE FROM menus WHERE nombre = $1`, [NOMBRE_MENU_TEST]);
    await pool.query(`DELETE FROM usuarios WHERE email = $1`, [
      EMAIL_USUARIO_TEST,
    ]);

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
    await pool.query(`DELETE FROM usuarios WHERE id = $1`, [usuarioId]);
    await pool.end();
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
