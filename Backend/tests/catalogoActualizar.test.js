jest.mock("../src/repositories/catalogoRepository");

const catalogoRepository = require("../src/repositories/catalogoRepository");
const catalogoService = require("../src/services/catalogoService");

describe("Servicio de Catálogo — actualizarArticulo (HU-07)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    catalogoRepository.actualizarArticulo.mockImplementation(async (id, campos) => ({
      id,
      nombre: "Arroz",
      stock_minimo: "20",
      ...campos,
    }));
  });

  test("actualiza el stock mínimo y devuelve el artículo con número", async () => {
    const r = await catalogoService.actualizarArticulo("5", { stockMinimo: "12.5" });
    expect(catalogoRepository.actualizarArticulo).toHaveBeenCalledWith(5, { stock_minimo: 12.5 });
    expect(r.stock_minimo).toBe(12.5);
  });

  test("acepta stock mínimo 0 (sin alerta)", async () => {
    await catalogoService.actualizarArticulo(5, { stockMinimo: 0 });
    expect(catalogoRepository.actualizarArticulo).toHaveBeenCalledWith(5, { stock_minimo: 0 });
  });

  test("solo envía los campos recibidos y normaliza el nombre", async () => {
    await catalogoService.actualizarArticulo(5, { nombre: "  Arroz   fino ", esPerecedero: true });
    expect(catalogoRepository.actualizarArticulo).toHaveBeenCalledWith(5, {
      nombre: "Arroz fino",
      es_perecedero: true,
    });
  });

  test("rechaza stock mínimo inválido", async () => {
    for (const valor of [-1, "abc", "", null, NaN]) {
      await expect(catalogoService.actualizarArticulo(5, { stockMinimo: valor })).rejects.toThrow(
        "stockMinimo debe ser un número mayor o igual a cero",
      );
    }
    expect(catalogoRepository.actualizarArticulo).not.toHaveBeenCalled();
  });

  test("rechaza id inválido, cuerpo vacío y campos inválidos", async () => {
    await expect(catalogoService.actualizarArticulo("x", { stockMinimo: 1 })).rejects.toThrow(/id debe ser/);
    await expect(catalogoService.actualizarArticulo(5, {})).rejects.toThrow(/al menos un campo/);
    await expect(catalogoService.actualizarArticulo(5, { nombre: "  " })).rejects.toThrow(/nombre no puede/);
    await expect(catalogoService.actualizarArticulo(5, { categoriaId: 0 })).rejects.toThrow(/categoriaId/);
    await expect(catalogoService.actualizarArticulo(5, { unidadMedida: "" })).rejects.toThrow(/unidadMedida/);
    await expect(catalogoService.actualizarArticulo(5, { esPerecedero: "si" })).rejects.toThrow(/esPerecedero/);
  });

  test("artículo inexistente", async () => {
    catalogoRepository.actualizarArticulo.mockResolvedValue(undefined);
    await expect(catalogoService.actualizarArticulo(999, { stockMinimo: 1 })).rejects.toThrow("El artículo no existe");
  });

  test("errores de base de datos", async () => {
    catalogoRepository.actualizarArticulo.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "23505" }));
    await expect(catalogoService.actualizarArticulo(5, { nombre: "A" })).rejects.toThrow(/Ya existe un artículo/);
    catalogoRepository.actualizarArticulo.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "23503" }));
    await expect(catalogoService.actualizarArticulo(5, { categoriaId: 99999 })).rejects.toThrow(/categoría/);
  });
});
