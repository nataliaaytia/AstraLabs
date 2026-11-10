const pool = require("../db/pool");
const donanteService = require("./donanteService");

const NOMBRE_DONANTE_TEST = "Donante Test HU-14";
const NOMBRE_EMPRESA_TEST = "Empresa Test HU-14";

describe("Donantes — integración real (RF-14)", () => {
  afterAll(async () => {
    await pool.query(`DELETE FROM donantes WHERE nombre IN ($1, $2)`, [
      NOMBRE_DONANTE_TEST,
      NOMBRE_EMPRESA_TEST,
    ]);
    await pool.end();
  });

  beforeAll(async () => {
    await pool.query(`DELETE FROM donantes WHERE nombre IN ($1, $2)`, [
      NOMBRE_DONANTE_TEST,
      NOMBRE_EMPRESA_TEST,
    ]);
  });

  test("registra un donante persona y queda disponible al listar", async () => {
    const creado = await donanteService.registrarDonante({
      nombre: NOMBRE_DONANTE_TEST,
      tipo: "persona",
      contacto: "Juana Pérez",
      telefono: "70000000",
      email: "juana@test.com",
    });

    expect(creado.id).toBeDefined();

    const lista = await donanteService.listarDonantes();
    const encontrado = lista.find((d) => d.id === creado.id);

    expect(encontrado).toBeDefined();
    expect(encontrado.nombre).toBe(NOMBRE_DONANTE_TEST);
    expect(encontrado.tipo).toBe("persona");
  });

  test("registra una empresa benefactora sin datos de contacto", async () => {
    const creado = await donanteService.registrarDonante({
      nombre: NOMBRE_EMPRESA_TEST,
      tipo: "empresa",
    });

    expect(creado.tipo).toBe("empresa");
    expect(creado.contacto).toBeNull();
  });

  test("rechaza un tipo inválido contra la base real (CHECK constraint de respaldo)", async () => {
    await expect(
      donanteService.registrarDonante({ nombre: "X", tipo: "ong" }),
    ).rejects.toThrow("tipo debe ser uno de");
  });
});
