jest.mock("../repositories/planComidaRepository");

const planComidaRepository = require("../repositories/planComidaRepository");
const planComidaService = require("./planComidaService");

describe("Servicio de Plan de Comidas (RF-17)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("registra un plan válido", async () => {
    planComidaRepository.crearPlan.mockResolvedValue({
      id: 1,
      fecha: "2026-11-10",
      tipo_comida: "almuerzo",
      menu_id: 2,
      comensales: 15,
      estado: "planificado",
    });

    const resultado = await planComidaService.registrarPlan({
      fecha: "2026-11-10",
      tipoComida: "almuerzo",
      menuId: 2,
      comensales: 15,
      usuarioId: 3,
    });

    expect(resultado.estado).toBe("planificado");
    expect(planComidaRepository.crearPlan).toHaveBeenCalledWith({
      fecha: "2026-11-10",
      tipoComida: "almuerzo",
      menuId: 2,
      comensales: 15,
      usuarioId: 3,
    });
  });

  test("rechaza sin fecha", async () => {
    await expect(
      planComidaService.registrarPlan({
        tipoComida: "almuerzo",
        menuId: 2,
        comensales: 10,
        usuarioId: 3,
      }),
    ).rejects.toThrow("fecha es obligatoria");
  });

  test("rechaza un tipo de comida inválido", async () => {
    await expect(
      planComidaService.registrarPlan({
        fecha: "2026-11-10",
        tipoComida: "cena",
        menuId: 2,
        comensales: 10,
        usuarioId: 3,
      }),
    ).rejects.toThrow("tipoComida debe ser uno de");
  });

  test("rechaza comensales inválidos", async () => {
    await expect(
      planComidaService.registrarPlan({
        fecha: "2026-11-10",
        tipoComida: "almuerzo",
        menuId: 2,
        comensales: 0,
        usuarioId: 3,
      }),
    ).rejects.toThrow("comensales debe ser un número entero mayor a cero");
  });

  test("traduce la violación de unicidad (fecha+tipo duplicados) a un mensaje claro", async () => {
    const error = new Error("duplicate key");
    error.code = "23505";
    planComidaRepository.crearPlan.mockRejectedValue(error);

    await expect(
      planComidaService.registrarPlan({
        fecha: "2026-11-10",
        tipoComida: "almuerzo",
        menuId: 2,
        comensales: 10,
        usuarioId: 3,
      }),
    ).rejects.toThrow(
      "Ya existe un plan registrado para esa fecha y tipo de comida",
    );
  });

  test("traduce la violación de FK (menú inexistente) a un mensaje claro", async () => {
    const error = new Error("fk violation");
    error.code = "23503";
    planComidaRepository.crearPlan.mockRejectedValue(error);

    await expect(
      planComidaService.registrarPlan({
        fecha: "2026-11-10",
        tipoComida: "almuerzo",
        menuId: 999,
        comensales: 10,
        usuarioId: 3,
      }),
    ).rejects.toThrow("El menú seleccionado no existe");
  });

  test("lista planes delegando al repositorio", async () => {
    planComidaRepository.listarPlanes.mockResolvedValue([
      { id: 1, fecha: "2026-11-10" },
    ]);

    const resultado = await planComidaService.listarPlanes({
      fecha: "2026-11-10",
    });

    expect(resultado).toEqual([{ id: 1, fecha: "2026-11-10" }]);
    expect(planComidaRepository.listarPlanes).toHaveBeenCalledWith({
      fecha: "2026-11-10",
    });
  });
});
