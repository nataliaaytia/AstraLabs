jest.mock("../repositories/menuRepository");

const menuRepository = require("../repositories/menuRepository");
const menuService = require("./menuService");

describe("Servicio de Menús (RF-16)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("registra un menú con sus ingredientes", async () => {
    menuRepository.crearMenu.mockResolvedValue({
      id: 1,
      nombre: "Menú Almuerzo",
      descripcion: null,
    });

    const resultado = await menuService.registrarMenu({
      nombre: "Menú Almuerzo",
      ingredientes: [
        { articuloId: 1, cantidadPorPorcion: 0.2 },
        { articuloId: 2, cantidadPorPorcion: "0.05" },
      ],
    });

    expect(resultado.id).toBe(1);
    expect(menuRepository.crearMenu).toHaveBeenCalledWith({
      nombre: "Menú Almuerzo",
      descripcion: null,
      ingredientes: [
        { articuloId: 1, cantidadPorPorcion: 0.2 },
        { articuloId: 2, cantidadPorPorcion: 0.05 },
      ],
    });
  });

  test("rechaza sin nombre", async () => {
    await expect(
      menuService.registrarMenu({
        ingredientes: [{ articuloId: 1, cantidadPorPorcion: 1 }],
      }),
    ).rejects.toThrow("nombre es obligatorio");
  });

  test("rechaza sin ingredientes", async () => {
    await expect(
      menuService.registrarMenu({ nombre: "X", ingredientes: [] }),
    ).rejects.toThrow("el menú debe tener al menos un ingrediente");
  });

  test("rechaza una cantidad por porción inválida", async () => {
    await expect(
      menuService.registrarMenu({
        nombre: "X",
        ingredientes: [{ articuloId: 1, cantidadPorPorcion: 0 }],
      }),
    ).rejects.toThrow("cantidadPorPorcion debe ser mayor a cero");
  });

  test("rechaza ingredientes con el mismo artículo repetido", async () => {
    await expect(
      menuService.registrarMenu({
        nombre: "X",
        ingredientes: [
          { articuloId: 1, cantidadPorPorcion: 1 },
          { articuloId: 1, cantidadPorPorcion: 2 },
        ],
      }),
    ).rejects.toThrow("está repetido en los ingredientes");
    expect(menuRepository.crearMenu).not.toHaveBeenCalled();
  });

  test("traduce la violación de FK (artículo inexistente) a un mensaje claro", async () => {
    const error = new Error("fk violation");
    error.code = "23503";
    menuRepository.crearMenu.mockRejectedValue(error);

    await expect(
      menuService.registrarMenu({
        nombre: "X",
        ingredientes: [{ articuloId: 999, cantidadPorPorcion: 1 }],
      }),
    ).rejects.toThrow("Uno de los artículos seleccionados no existe");
  });

  test("obtenerMenu lanza si no existe", async () => {
    menuRepository.obtenerMenuConIngredientes.mockResolvedValue(null);

    await expect(menuService.obtenerMenu(999)).rejects.toThrow(
      "El menú no existe",
    );
  });

  test("listarMenus delega al repositorio", async () => {
    menuRepository.listarMenus.mockResolvedValue([
      { id: 1, nombre: "Menú Almuerzo" },
    ]);

    const resultado = await menuService.listarMenus();

    expect(resultado).toEqual([{ id: 1, nombre: "Menú Almuerzo" }]);
  });
});
