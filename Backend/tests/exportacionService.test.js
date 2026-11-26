const ExcelJS = require("exceljs");

jest.mock("../src/services/catalogoService");
jest.mock("../src/services/menuService");
jest.mock("../src/services/planComidaService");
jest.mock("../src/services/reporteService");

const catalogoService = require("../src/services/catalogoService");
const menuService = require("../src/services/menuService");
const planComidaService = require("../src/services/planComidaService");
const reporteService = require("../src/services/reporteService");
const exportacionService = require("../src/services/exportacionService");

async function filasExcel(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const filas = [];
  ws.eachRow((row, n) => {
    if (n > 6) filas.push(row.values.slice(1));
  });
  return { ws, filas };
}

beforeEach(() => jest.clearAllMocks());

describe("exportarArticulos", () => {
  test("reenvía los filtros al servicio y marca el estado", async () => {
    catalogoService.listarArticulos.mockResolvedValue([
      { id: 1, nombre: "Arroz", categoria: "Alimentos", unidad_medida: "kg", es_perecedero: false, stock_actual: "10.00", stock_minimo: "20.00" },
      { id: 2, nombre: "Sal", categoria: "Alimentos", unidad_medida: "kg", es_perecedero: false, stock_actual: "5.00", stock_minimo: "1.00" },
    ]);
    const r = await exportacionService.exportarArticulos({
      formato: "xlsx",
      categoriaId: "1",
      q: "a",
      bajoMinimo: true,
    });
    expect(catalogoService.listarArticulos).toHaveBeenCalledWith({
      categoriaId: "1",
      q: "a",
      bajoMinimo: true,
    });
    const { ws, filas } = await filasExcel(r.buffer);
    expect(ws.getCell("A3").value).toMatch(/nombre contiene "a".*categoría: Alimentos.*bajo el stock mínimo/);
    expect(filas.map((f) => f[0])).toEqual(["Arroz", "Sal"]);
    expect(filas.map((f) => f[6])).toEqual(["Bajo el mínimo", "Normal"]);
  });

  test("formato inválido falla ANTES de consultar", async () => {
    await expect(exportacionService.exportarArticulos({ formato: "csv" })).rejects.toThrow(/formato/);
    expect(catalogoService.listarArticulos).not.toHaveBeenCalled();
  });
});

describe("exportarMenus", () => {
  test("una fila por ingrediente con el nombre del artículo", async () => {
    menuService.listarMenus.mockResolvedValue([
      { id: 1, nombre: "Sopa", descripcion: "Almuerzo", ingredientes: [{ articuloId: 1, cantidadPorPorcion: 0.2 }, { articuloId: 99, cantidadPorPorcion: 0.1 }] },
    ]);
    catalogoService.listarArticulos.mockResolvedValue([
      { id: 1, nombre: "Arroz", unidad_medida: "kg" },
    ]);
    const r = await exportacionService.exportarMenus({ formato: "xlsx", q: "sop" });
    expect(menuService.listarMenus).toHaveBeenCalledWith({ q: "sop" });
    const { filas } = await filasExcel(r.buffer);
    expect(filas).toEqual([
      ["Sopa", "Almuerzo", "Arroz", 0.2, "kg"],
      ["Sopa", "Almuerzo", "Artículo #99", 0.1, ""],
    ]);
    const pdf = await exportacionService.exportarMenus({ formato: "pdf" });
    expect(pdf.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("exportarPlanes", () => {
  beforeEach(() => planComidaService.listarPlanes.mockResolvedValue([]));

  test("mes se convierte en desde/hasta (fin de mes y año bisiesto)", async () => {
    await exportacionService.exportarPlanes({ formato: "xlsx", mes: "2026-11" });
    expect(planComidaService.listarPlanes).toHaveBeenLastCalledWith(
      expect.objectContaining({ desde: "2026-11-01", hasta: "2026-11-30" }),
    );
    await exportacionService.exportarPlanes({ formato: "xlsx", mes: "2028-02" });
    expect(planComidaService.listarPlanes).toHaveBeenLastCalledWith(
      expect.objectContaining({ desde: "2028-02-01", hasta: "2028-02-29" }),
    );
    await exportacionService.exportarPlanes({ formato: "xlsx", mes: "2026-12" });
    expect(planComidaService.listarPlanes).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasta: "2026-12-31" }),
    );
  });

  test("mes inválido, o combinado con fechas, es error", async () => {
    await expect(exportacionService.exportarPlanes({ formato: "xlsx", mes: "2026-13" })).rejects.toThrow(/mes debe tener formato/);
    await expect(exportacionService.exportarPlanes({ formato: "xlsx", mes: "noviembre" })).rejects.toThrow(/mes debe tener formato/);
    await expect(exportacionService.exportarPlanes({ formato: "xlsx", mes: "2026-11", desde: "2026-11-05" })).rejects.toThrow(/no ambos/);
  });

  test("ordena por fecha y desayuno → almuerzo → merienda", async () => {
    planComidaService.listarPlanes.mockResolvedValue([
      { fecha: "2026-11-02", tipo_comida: "almuerzo", menu: "B", comensales: 5, estado: "pendiente" },
      { fecha: "2026-11-01", tipo_comida: "merienda", menu: "C", comensales: 5, estado: "pendiente" },
      { fecha: "2026-11-01", tipo_comida: "almuerzo", menu: "A", comensales: 5, estado: "confirmado" },
      { fecha: "2026-11-01", tipo_comida: "desayuno", menu: "D", comensales: 5, estado: "pendiente" },
    ]);
    const r = await exportacionService.exportarPlanes({ formato: "xlsx", mes: "2026-11" });
    const { filas } = await filasExcel(r.buffer);
    expect(filas.map((f) => `${f[0]} ${f[1]}`)).toEqual([
      "01/11/2026 Desayuno",
      "01/11/2026 Almuerzo",
      "01/11/2026 Merienda",
      "02/11/2026 Almuerzo",
    ]);
  });

  test("reenvía tipo de comida y estado", async () => {
    await exportacionService.exportarPlanes({ formato: "pdf", desde: "2026-11-01", tipoComida: "almuerzo", estado: "confirmado" });
    expect(planComidaService.listarPlanes).toHaveBeenCalledWith({
      fecha: undefined,
      desde: "2026-11-01",
      hasta: undefined,
      tipoComida: "almuerzo",
      estado: "confirmado",
    });
  });
});

describe("exportarNecesidadesCriticas", () => {
  test("exporta el reporte con el límite pedido", async () => {
    reporteService.obtenerNecesidadesCriticas.mockResolvedValue([
      { articulo_id: 1, articulo: "Arroz", stock_actual: 5, stock_minimo: 20, deficit: 15, porcentaje_cubierto: 25 },
    ]);
    const r = await exportacionService.exportarNecesidadesCriticas({ formato: "xlsx", limite: "5" });
    expect(reporteService.obtenerNecesidadesCriticas).toHaveBeenCalledWith({ limite: "5" });
    const { ws, filas } = await filasExcel(r.buffer);
    expect(ws.getCell("A3").value).toBe("Filtros: máximo 5 artículos");
    expect(filas).toEqual([["Arroz", 5, 20, 15, 25]]);
  });
});
