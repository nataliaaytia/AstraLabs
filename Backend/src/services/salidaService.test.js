jest.mock("../repositories/inventarioRepository");

const inventarioRepository = require("../repositories/inventarioRepository");
const { registrarSalida } = require("./salidaService");

describe("Servicio de Salidas (RF-03)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("registra una salida descontando por FEFO y persiste el movimiento", async () => {
    inventarioRepository.obtenerLotesConStock.mockResolvedValue([
      { id: 1, cantidad_disponible: 10, fecha_vencimiento: "2026-12-01" },
      { id: 2, cantidad_disponible: 10, fecha_vencimiento: "2026-10-20" }, // vence antes
    ]);
    inventarioRepository.registrarSalida.mockResolvedValue(42);

    const resultado = await registrarSalida({
      articuloId: 7,
      cantidad: 5,
      usuarioId: 1,
      destino: "Cocina",
    });

    expect(resultado).toEqual({
      movimientoId: 42,
      detalle: [{ lote_id: 2, cantidad_descontada: 5 }],
    });

    expect(inventarioRepository.registrarSalida).toHaveBeenCalledWith(
      expect.objectContaining({
        articuloId: 7,
        cantidadTotal: 5,
        usuarioId: 1,
        destino: "Cocina",
        movimientosFEFO: [{ lote_id: 2, cantidad_descontada: 5 }],
      }),
    );
  });

  test("rechaza la salida si falta el destino (RF-03)", async () => {
    await expect(
      registrarSalida({
        articuloId: 7,
        cantidad: 5,
        usuarioId: 1,
        destino: "",
      }),
    ).rejects.toThrow("destino es obligatorio");

    expect(inventarioRepository.obtenerLotesConStock).not.toHaveBeenCalled();
  });

  test("propaga el error de stock insuficiente del Gestor de Inventario y FEFO", async () => {
    inventarioRepository.obtenerLotesConStock.mockResolvedValue([
      { id: 1, cantidad_disponible: 2, fecha_vencimiento: "2026-12-01" },
    ]);

    await expect(
      registrarSalida({
        articuloId: 7,
        cantidad: 5,
        usuarioId: 1,
        destino: "Cocina",
      }),
    ).rejects.toThrow("Stock insuficiente");

    expect(inventarioRepository.registrarSalida).not.toHaveBeenCalled();
  });
});
