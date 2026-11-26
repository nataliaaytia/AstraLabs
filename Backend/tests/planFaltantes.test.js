jest.mock("../src/repositories/planComidaRepository");

const repo = require("../src/repositories/planComidaRepository");
const planComidaService = require("../src/services/planComidaService");

const plan = { id: 4, fecha: "2026-12-01", tipo_comida: "almuerzo", comensales: 40, estado: "planificado", menu_id: 2, menu: "Sopa de maní" };
const fila = (extra) => ({
  articulo_id: 1, articulo: "Arroz", categoria: "Alimentos", unidad_medida: "kg",
  cantidad_por_porcion: "0.500", requerida: "20.000", disponible: "20.00", faltante: "0.000", ...extra,
});

beforeEach(() => {
  jest.resetAllMocks();
  repo.obtenerPlan.mockResolvedValue(plan);
  repo.calcularIngredientesPlan.mockResolvedValue([]);
});

describe("Faltantes de un plan de comidas (RF-18)", () => {
  test("clasifica cada insumo y pone primero los faltantes", async () => {
    repo.calcularIngredientesPlan.mockResolvedValue([
      fila({ articulo_id: 1, articulo: "Arroz" }), // justo alcanza
      fila({ articulo_id: 2, articulo: "Harina", requerida: "10.000", disponible: "5.00", faltante: "5.000" }),
      fila({ articulo_id: 3, articulo: "Sal", requerida: "0.400", disponible: "0", faltante: "0.400" }),
      fila({ articulo_id: 4, articulo: "Aceite", requerida: "4.000", disponible: "2.00", faltante: "2.000" }),
    ]);
    const r = await planComidaService.obtenerFaltantesPlan("4");

    expect(r.ingredientes.map((i) => [i.articulo, i.estado])).toEqual([
      ["Sal", "sin_stock"],
      ["Aceite", "insuficiente"],
      ["Harina", "insuficiente"],
      ["Arroz", "suficiente"],
    ]);
    expect(r).toMatchObject({ total_ingredientes: 4, con_faltantes: 3, puede_prepararse: false });
    expect(r.plan).toMatchObject({ id: 4, comensales: 40, menu: "Sopa de maní" });
    expect(r.ingredientes[2]).toMatchObject({ requerida: 10, disponible: 5, faltante: 5, cantidad_por_porcion: 0.5 });
  });

  test("si todo alcanza, el plan puede prepararse", async () => {
    repo.calcularIngredientesPlan.mockResolvedValue([fila({}), fila({ articulo_id: 2, articulo: "Sal", disponible: "30" })]);
    const r = await planComidaService.obtenerFaltantesPlan(4);
    expect(r).toMatchObject({ con_faltantes: 0, puede_prepararse: true });
    expect(r.advertencia).toBeUndefined();
  });

  test("un menú sin ingredientes no puede prepararse y avisa", async () => {
    const r = await planComidaService.obtenerFaltantesPlan(4);
    expect(r).toMatchObject({ total_ingredientes: 0, puede_prepararse: false });
    expect(r.advertencia).toMatch(/no tiene ingredientes/);
  });

  test("plan inexistente", async () => {
    repo.obtenerPlan.mockResolvedValue(null);
    await expect(planComidaService.obtenerFaltantesPlan(99)).rejects.toThrow("El plan de comidas no existe");
  });

  test("solo planes planificados: confirmado y cancelado dan error", async () => {
    repo.obtenerPlan.mockResolvedValue({ ...plan, estado: "confirmado" });
    await expect(planComidaService.obtenerFaltantesPlan(4)).rejects.toThrow("El plan ya fue confirmado");
    repo.obtenerPlan.mockResolvedValue({ ...plan, estado: "cancelado" });
    await expect(planComidaService.obtenerFaltantesPlan(4)).rejects.toThrow("El plan ya fue cancelado");
    expect(repo.calcularIngredientesPlan).not.toHaveBeenCalled();
  });

  test("valida el id", async () => {
    for (const id of ["x", 0, -1, 1.5, undefined]) {
      await expect(planComidaService.obtenerFaltantesPlan(id)).rejects.toThrow(/planId debe ser/);
    }
    expect(repo.obtenerPlan).not.toHaveBeenCalled();
  });
});
