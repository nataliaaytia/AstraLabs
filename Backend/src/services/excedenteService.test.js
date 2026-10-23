jest.mock("../repositories/inventarioRepository");

const inventarioRepository = require("../repositories/inventarioRepository");
const excedenteService = require("./excedenteService");

describe("Servicio de Excedentes (RF-09)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("registra un excedente descontando por FEFO", async () => {
    inventarioRepository.obtenerLotesConStock.mockResolvedValue([
      { id: 1, cantidad_disponible: 10, fecha_vencimiento: "2026-01-01" },
    ]);
    inventarioRepository.registrarExcedente.mockResolvedValue({
      movimientoId: 1,
      articuloId: 5,
      cantidadTotal: 4,
    });

    const resultado = await excedenteService.registrarExcedente({
      articuloId: 5,
      cantidad: 4,
      usuarioId: 1,
      destino: "Donación - Casa Hermana",
    });

    expect(resultado.movimientoId).toBe(1);
    expect(inventarioRepository.registrarExcedente).toHaveBeenCalledWith(
      expect.objectContaining({
        articuloId: 5,
        cantidadTotal: 4,
        usuarioId: 1,
        destino: "Donación - Casa Hermana",
        movimientosFEFO: [{ lote_id: 1, cantidad_descontada: 4 }],
      }),
    );
  });

  test("rechaza si falta el destino", async () => {
    await expect(
      excedenteService.registrarExcedente({
        articuloId: 5,
        cantidad: 4,
        usuarioId: 1,
        destino: "",
      }),
    ).rejects.toThrow("destino es obligatorio");

    expect(inventarioRepository.obtenerLotesConStock).not.toHaveBeenCalled();
  });

  test("propaga el error de stock insuficiente desde FEFO", async () => {
    inventarioRepository.obtenerLotesConStock.mockResolvedValue([
      { id: 1, cantidad_disponible: 2, fecha_vencimiento: null },
    ]);

    await expect(
      excedenteService.registrarExcedente({
        articuloId: 5,
        cantidad: 10,
        usuarioId: 1,
        destino: "Donación",
      }),
    ).rejects.toThrow();

    expect(inventarioRepository.registrarExcedente).not.toHaveBeenCalled();
  });
});
