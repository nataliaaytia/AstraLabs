jest.mock("../repositories/catalogoRepository");

const catalogoRepository = require("../repositories/catalogoRepository");
const catalogoService = require("./catalogoService");

describe("Servicio de Catálogo (RF-01, RF-07)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("lista categorías delegando al repositorio", async () => {
    catalogoRepository.listarCategorias.mockResolvedValue([
      { id: 1, nombre: "Alimentos" },
    ]);

    const resultado = await catalogoService.listarCategorias();

    expect(resultado).toEqual([{ id: 1, nombre: "Alimentos" }]);
  });

  test("lista artículos sin filtro de categoría", async () => {
    catalogoRepository.listarArticulos.mockResolvedValue([
      { id: 1, nombre: "Arroz" },
    ]);

    await catalogoService.listarArticulos({});

    expect(catalogoRepository.listarArticulos).toHaveBeenCalledWith({});
  });

  test("lista artículos filtrados por categoría, convirtiendo el id a número", async () => {
    catalogoRepository.listarArticulos.mockResolvedValue([
      { id: 1, nombre: "Arroz" },
    ]);

    await catalogoService.listarArticulos({ categoriaId: "1" });

    expect(catalogoRepository.listarArticulos).toHaveBeenCalledWith({
      categoriaId: 1,
    });
  });

  test("rechaza un categoriaId inválido", async () => {
    await expect(
      catalogoService.listarArticulos({ categoriaId: "abc" }),
    ).rejects.toThrow("categoriaId debe ser un número entero positivo");
    expect(catalogoRepository.listarArticulos).not.toHaveBeenCalled();
  });
});
