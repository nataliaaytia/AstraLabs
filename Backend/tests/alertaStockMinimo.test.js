jest.mock("../src/repositories/alertaRepository");

const repo = require("../src/repositories/alertaRepository");
const alertaService = require("../src/services/alertaService");

const art = (extra) => ({
  articulo_id: 1, articulo: "Arroz", categoria: "Alimentos", unidad_medida: "kg",
  stock_minimo: "10", stock_actual: "10", ...extra,
});

beforeEach(() => {
  jest.resetAllMocks();
  repo.listarArticulosEnMinimo.mockResolvedValue([]);
  repo.obtenerUmbralVencimiento.mockResolvedValue("7");
  repo.listarLotesPorVencer.mockResolvedValue([]);
});

describe("Alertas de stock mínimo (RF-11)", () => {
  test("clasifica: agotado, bajo el mínimo y justo en el mínimo", async () => {
    repo.listarArticulosEnMinimo.mockResolvedValue([
      art({ articulo_id: 1, stock_actual: "0" }),
      art({ articulo_id: 2, stock_actual: "4.50" }),
      art({ articulo_id: 3, stock_actual: "10.00" }),
    ]);
    const r = await alertaService.obtenerAlertasStockMinimo();
    expect(r).toMatchObject({ total: 3, agotados: 1, bajo_minimo: 1, en_minimo: 1 });
    expect(r.articulos.map((a) => a.estado)).toEqual(["agotado", "bajo_minimo", "en_minimo"]);
    expect(r.articulos[1]).toMatchObject({ stock_actual: 4.5, stock_minimo: 10, faltante: 5.5, porcentaje_cubierto: 45 });
    expect(r.articulos[2]).toMatchObject({ faltante: 0, porcentaje_cubierto: 100 });
    expect(r.articulos[0].porcentaje_cubierto).toBe(0);
  });

  test("sin artículos en el mínimo: resumen en cero", async () => {
    expect(await alertaService.obtenerAlertasStockMinimo()).toEqual({
      total: 0, agotados: 0, bajo_minimo: 0, en_minimo: 0, articulos: [],
    });
  });
});

describe("Resumen de alertas para el panel", () => {
  test("junta los totales de vencimiento y stock mínimo", async () => {
    repo.listarLotesPorVencer.mockResolvedValue([
      { lote_id: 1, dias_restantes: -2, cantidad_disponible: "1" },
      { lote_id: 2, dias_restantes: 3, cantidad_disponible: "1" },
    ]);
    repo.listarArticulosEnMinimo.mockResolvedValue([art({ stock_actual: "0" })]);
    expect(await alertaService.obtenerResumenAlertas()).toEqual({
      total: 3,
      vencimiento: { dias_anticipacion: 7, total: 2, vencidos: 1, por_vencer: 1 },
      stock_minimo: { total: 1, agotados: 1, bajo_minimo: 0, en_minimo: 0 },
    });
  });
});
