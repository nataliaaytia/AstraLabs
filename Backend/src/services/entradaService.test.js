jest.mock("../repositories/inventarioRepository");

const inventarioRepository = require("../repositories/inventarioRepository");
const entradaService = require("./entradaService");

describe("Servicio de Entradas (RF-02)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("registra una entrada con todos los datos", async () => {
    inventarioRepository.registrarEntrada.mockResolvedValue({
      movimientoId: 1,
      loteId: 10,
      articuloId: 5,
      cantidadTotal: 20,
    });

    const resultado = await entradaService.registrarEntrada({
      articuloId: 5,
      cantidad: 20,
      usuarioId: 2,
      donanteId: 3,
      fecha: "2026-11-04",
      fechaVencimiento: "2027-01-01",
      numeroLote: "DON-001",
    });

    expect(resultado.loteId).toBe(10);
    expect(inventarioRepository.registrarEntrada).toHaveBeenCalledWith({
      articuloId: 5,
      cantidad: 20,
      usuarioId: 2,
      donanteId: 3,
      fecha: "2026-11-04",
      fechaVencimiento: "2027-01-01",
      numeroLote: "DON-001",
    });
  });

  test("permite registrar sin donante (donación anónima / ingreso interno)", async () => {
    inventarioRepository.registrarEntrada.mockResolvedValue({
      movimientoId: 1,
      loteId: 10,
    });

    await entradaService.registrarEntrada({
      articuloId: 5,
      cantidad: 20,
      usuarioId: 2,
    });

    expect(inventarioRepository.registrarEntrada).toHaveBeenCalledWith(
      expect.objectContaining({
        donanteId: null,
        fecha: null,
        fechaVencimiento: null,
        numeroLote: null,
      }),
    );
  });

  test("rechaza sin articuloId", async () => {
    await expect(
      entradaService.registrarEntrada({ cantidad: 20, usuarioId: 2 }),
    ).rejects.toThrow("articuloId es obligatorio");
    expect(inventarioRepository.registrarEntrada).not.toHaveBeenCalled();
  });

  test("rechaza sin usuarioId", async () => {
    await expect(
      entradaService.registrarEntrada({ articuloId: 5, cantidad: 20 }),
    ).rejects.toThrow("usuarioId es obligatorio");
  });

  test("rechaza cantidad cero o negativa", async () => {
    await expect(
      entradaService.registrarEntrada({
        articuloId: 5,
        cantidad: 0,
        usuarioId: 2,
      }),
    ).rejects.toThrow("La cantidad debe ser mayor a cero");

    await expect(
      entradaService.registrarEntrada({
        articuloId: 5,
        cantidad: -3,
        usuarioId: 2,
      }),
    ).rejects.toThrow("La cantidad debe ser mayor a cero");
  });
});
