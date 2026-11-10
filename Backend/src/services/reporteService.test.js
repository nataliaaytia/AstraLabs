jest.mock("../repositories/reporteRepository");

const reporteRepository = require("../repositories/reporteRepository");
const reporteService = require("./reporteService");

describe("Servicio de Reportes (RF-21)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("devuelve las necesidades críticas con porcentaje cubierto calculado", async () => {
    reporteRepository.obtenerNecesidadesCriticas.mockResolvedValue([
      {
        articulo_id: 1,
        articulo: "Arroz",
        stock_minimo: "20",
        stock_actual: "5",
        deficit: "15",
      },
    ]);

    const resultado = await reporteService.obtenerNecesidadesCriticas({});

    expect(resultado).toEqual([
      {
        articulo_id: 1,
        articulo: "Arroz",
        stock_actual: 5,
        stock_minimo: 20,
        deficit: 15,
        porcentaje_cubierto: 25,
      },
    ]);
  });

  test("pasa el límite al repositorio cuando se especifica", async () => {
    reporteRepository.obtenerNecesidadesCriticas.mockResolvedValue([]);

    await reporteService.obtenerNecesidadesCriticas({ limite: "5" });

    expect(reporteRepository.obtenerNecesidadesCriticas).toHaveBeenCalledWith({
      limite: 5,
    });
  });

  test("sin límite, lo pasa como undefined", async () => {
    reporteRepository.obtenerNecesidadesCriticas.mockResolvedValue([]);

    await reporteService.obtenerNecesidadesCriticas({});

    expect(reporteRepository.obtenerNecesidadesCriticas).toHaveBeenCalledWith({
      limite: undefined,
    });
  });

  test("rechaza un límite inválido", async () => {
    await expect(
      reporteService.obtenerNecesidadesCriticas({ limite: "abc" }),
    ).rejects.toThrow("limite debe ser un número entero positivo");
    await expect(
      reporteService.obtenerNecesidadesCriticas({ limite: "-3" }),
    ).rejects.toThrow("limite debe ser un número entero positivo");
    expect(reporteRepository.obtenerNecesidadesCriticas).not.toHaveBeenCalled();
  });
});
