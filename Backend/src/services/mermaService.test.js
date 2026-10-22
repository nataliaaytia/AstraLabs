jest.mock("../repositories/inventarioRepository");

const inventarioRepository = require("../repositories/inventarioRepository");
const { registrarMerma } = require("./mermaService");

describe("Servicio de Mermas (RF-06)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("registra una merma descontando por FEFO y persiste el motivo", async () => {
    inventarioRepository.obtenerLotesConStock.mockResolvedValue([
      { id: 1, cantidad_disponible: 10, fecha_vencimiento: "2026-12-01" },
      { id: 2, cantidad_disponible: 10, fecha_vencimiento: "2026-10-20" },
    ]);
    inventarioRepository.registrarMerma.mockResolvedValue(99);

    const resultado = await registrarMerma({
      articuloId: 7,
      cantidad: 3,
      usuarioId: 1,
      motivo: "deterioro",
    });

    expect(resultado).toEqual({
      movimientoId: 99,
      detalle: [{ lote_id: 2, cantidad_descontada: 3 }],
    });

    expect(inventarioRepository.registrarMerma).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: "deterioro" }),
    );
  });

  test.each(["vencimiento", "deterioro", "perdida"])(
    "acepta el motivo válido '%s'",
    async (motivo) => {
      inventarioRepository.obtenerLotesConStock.mockResolvedValue([
        { id: 1, cantidad_disponible: 5, fecha_vencimiento: null },
      ]);
      inventarioRepository.registrarMerma.mockResolvedValue(1);

      await expect(
        registrarMerma({ articuloId: 7, cantidad: 1, usuarioId: 1, motivo }),
      ).resolves.toBeDefined();
    },
  );

  test("rechaza un motivo que no está en la lista permitida (RF-06)", async () => {
    await expect(
      registrarMerma({
        articuloId: 7,
        cantidad: 3,
        usuarioId: 1,
        motivo: "se perdio nomas",
      }),
    ).rejects.toThrow("motivo debe ser uno de");

    expect(inventarioRepository.obtenerLotesConStock).not.toHaveBeenCalled();
  });

  test("propaga el error de stock insuficiente del Gestor de Inventario y FEFO", async () => {
    inventarioRepository.obtenerLotesConStock.mockResolvedValue([
      { id: 1, cantidad_disponible: 1, fecha_vencimiento: "2026-12-01" },
    ]);

    await expect(
      registrarMerma({
        articuloId: 7,
        cantidad: 5,
        usuarioId: 1,
        motivo: "perdida",
      }),
    ).rejects.toThrow("Stock insuficiente");

    expect(inventarioRepository.registrarMerma).not.toHaveBeenCalled();
  });
});
