jest.mock("../src/repositories/alertaRepository");

const repo = require("../src/repositories/alertaRepository");
const alertaService = require("../src/services/alertaService");

const fila = (extra) => ({
  lote_id: 1, numero_lote: "L1", fecha_vencimiento: "2026-11-25", dias_restantes: 2,
  cantidad_disponible: "4.50", articulo_id: 7, articulo: "Leche", unidad_medida: "litro", categoria: "Alimentos",
  ...extra,
});

beforeEach(() => {
  jest.resetAllMocks();
  repo.obtenerUmbralVencimiento.mockResolvedValue("7");
  repo.listarLotesPorVencer.mockResolvedValue([]);
});

describe("Umbral de días (configurable)", () => {
  test("devuelve el umbral guardado", async () => {
    repo.obtenerUmbralVencimiento.mockResolvedValue("14");
    expect(await alertaService.obtenerUmbralVencimiento()).toEqual({ dias: 14 });
  });

  test("si falta o está dañado, usa 7 por defecto", async () => {
    repo.obtenerUmbralVencimiento.mockResolvedValue(null);
    expect(await alertaService.obtenerUmbralVencimiento()).toEqual({ dias: 7 });
    repo.obtenerUmbralVencimiento.mockResolvedValue("abc");
    expect(await alertaService.obtenerUmbralVencimiento()).toEqual({ dias: 7 });
  });

  test("configura un umbral válido", async () => {
    expect(await alertaService.configurarUmbralVencimiento("10")).toEqual({ dias: 10 });
    expect(repo.guardarUmbralVencimiento).toHaveBeenCalledWith(10);
  });

  test("rechaza umbrales inválidos y no guarda", async () => {
    for (const v of [0, -1, 366, 2.5, "abc", "", null, undefined, true]) {
      await expect(alertaService.configurarUmbralVencimiento(v)).rejects.toThrow("dias debe ser un entero entre 1 y 365");
    }
    expect(repo.guardarUmbralVencimiento).not.toHaveBeenCalled();
  });
});

describe("Alertas de vencimiento (RF-10)", () => {
  test("usa el umbral configurado y clasifica vencidos y por vencer", async () => {
    repo.obtenerUmbralVencimiento.mockResolvedValue("10");
    repo.listarLotesPorVencer.mockResolvedValue([
      fila({ lote_id: 1, dias_restantes: -3, fecha_vencimiento: "2026-11-20" }),
      fila({ lote_id: 2, dias_restantes: 0 }),
      fila({ lote_id: 3, dias_restantes: 9 }),
    ]);
    const r = await alertaService.obtenerAlertasVencimiento();
    expect(repo.listarLotesPorVencer).toHaveBeenCalledWith(10);
    expect(r).toMatchObject({ dias_anticipacion: 10, total: 3, vencidos: 1, por_vencer: 2 });
    expect(r.lotes.map((l) => l.estado)).toEqual(["vencido", "por_vencer", "por_vencer"]);
    expect(r.lotes[0]).toMatchObject({ articulo: "Leche", cantidad_disponible: 4.5, dias_restantes: -3 });
  });

  test("?dias reemplaza el umbral solo en esa consulta", async () => {
    await alertaService.obtenerAlertasVencimiento({ dias: "30" });
    expect(repo.listarLotesPorVencer).toHaveBeenCalledWith(30);
    expect(repo.obtenerUmbralVencimiento).not.toHaveBeenCalled();
    expect(repo.guardarUmbralVencimiento).not.toHaveBeenCalled();
  });

  test("dias inválido en la consulta da error", async () => {
    await expect(alertaService.obtenerAlertasVencimiento({ dias: "0" })).rejects.toThrow(/dias debe ser/);
    await expect(alertaService.obtenerAlertasVencimiento({ dias: "x" })).rejects.toThrow(/dias debe ser/);
  });

  test("sin lotes: resumen en cero", async () => {
    expect(await alertaService.obtenerAlertasVencimiento()).toEqual({
      dias_anticipacion: 7, total: 0, vencidos: 0, por_vencer: 0, lotes: [],
    });
  });
});
