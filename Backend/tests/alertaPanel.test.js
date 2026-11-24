jest.mock("../src/repositories/alertaRepository");

const repo = require("../src/repositories/alertaRepository");
const alertaService = require("../src/services/alertaService");

const base = {
  id: 1, tipo: "stock_minimo", estado: "pendiente", fecha_generada: "2026-11-23T10:00:00Z", fecha_atendida: null,
  atendida_por: null, articulo_id: 5, articulo: "Arroz", categoria: "Alimentos", unidad_medida: "kg",
  stock_minimo: "10.00", stock_actual: "4.00", lote_id: null, numero_lote: null, fecha_vencimiento: null,
  dias_restantes: null, cantidad_lote: null,
};

beforeEach(() => {
  jest.resetAllMocks();
  repo.obtenerUmbralVencimiento.mockResolvedValue("7");
  repo.sincronizarAlertas.mockResolvedValue({ creadas: 0, resueltas: 0 });
  repo.listarAlertas.mockResolvedValue([]);
  repo.contarAlertas.mockResolvedValue({});
});

describe("Panel de alertas (RF-12)", () => {
  test("sincroniza con el umbral configurado y lista pendientes y atendidas con totales", async () => {
    repo.listarAlertas.mockResolvedValue([
      base,
      { ...base, id: 2, estado: "atendida", atendida_por: "Ana", fecha_atendida: "2026-11-23T11:00:00Z" },
    ]);
    repo.contarAlertas.mockResolvedValue({ pendiente: 1, atendida: 1 });

    const r = await alertaService.listarAlertas();
    expect(repo.sincronizarAlertas).toHaveBeenCalledWith({ diasVencimiento: 7, articuloIds: null });
    expect(r).toMatchObject({ total: 2, pendientes: 1, atendidas: 1 });
    expect(r.alertas.map((a) => a.estado)).toEqual(["pendiente", "atendida"]);
    expect(r.alertas[1].atendida_por).toBe("Ana");
    expect(r.alertas[0]).toMatchObject({ stock_actual: 4, stock_minimo: 10, mensaje: "Arroz: stock 4 kg, mínimo 10 kg" });
  });

  test("mensaje de vencimiento: vencido, hoy y por vencer", async () => {
    const venc = (dias) => ({
      ...base, tipo: "vencimiento", articulo: "Leche", unidad_medida: "litro", lote_id: 9, numero_lote: "L1",
      fecha_vencimiento: "2026-11-26", dias_restantes: dias, cantidad_lote: "3.00",
    });
    repo.listarAlertas.mockResolvedValue([venc(-2), venc(0), venc(1), venc(5)]);
    const m = (await alertaService.listarAlertas()).alertas.map((a) => a.mensaje);
    expect(m[0]).toMatch(/lote L1 venció hace 2 días .* 3 litro disponibles/);
    expect(m[1]).toMatch(/vence hoy/);
    expect(m[2]).toMatch(/vence en 1 día /);
    expect(m[3]).toMatch(/vence en 5 días/);
  });

  test("sincronizar=false solo lee", async () => {
    await alertaService.listarAlertas({ sincronizar: false });
    expect(repo.sincronizarAlertas).not.toHaveBeenCalled();
  });

  test("pasa los filtros al repositorio y aplica el límite por defecto", async () => {
    await alertaService.listarAlertas({ estado: "pendiente", tipo: "vencimiento", q: "leche" });
    expect(repo.listarAlertas).toHaveBeenCalledWith({ estado: "pendiente", tipo: "vencimiento", q: "leche", limite: 100 });
    expect(repo.contarAlertas).toHaveBeenCalledWith({ tipo: "vencimiento", q: "leche" });
  });

  test("valida estado, tipo y límite", async () => {
    await expect(alertaService.listarAlertas({ estado: "x" })).rejects.toThrow(/estado debe ser uno de: pendiente, atendida/);
    await expect(alertaService.listarAlertas({ tipo: "x" })).rejects.toThrow(/tipo debe ser uno de/);
    for (const limite of [0, 501, "abc", 2.5]) {
      await expect(alertaService.listarAlertas({ limite })).rejects.toThrow(/limite debe ser un entero entre 1 y 500/);
    }
    expect(repo.listarAlertas).not.toHaveBeenCalled();
  });
});

describe("Atender una alerta", () => {
  test("marca como atendida con el usuario", async () => {
    repo.atenderAlerta.mockResolvedValue({ id: 3 });
    expect(await alertaService.atenderAlerta("3", 2)).toEqual({ id: 3, estado: "atendida" });
    expect(repo.atenderAlerta).toHaveBeenCalledWith(3, 2);
  });

  test("distingue alerta inexistente de ya atendida", async () => {
    repo.atenderAlerta.mockResolvedValue(null);
    repo.existeAlerta.mockResolvedValue(false);
    await expect(alertaService.atenderAlerta(3, 2)).rejects.toThrow("La alerta no existe");
    repo.existeAlerta.mockResolvedValue(true);
    await expect(alertaService.atenderAlerta(3, 2)).rejects.toThrow("La alerta ya fue atendida");
  });

  test("valida id y usuario", async () => {
    await expect(alertaService.atenderAlerta("x", 2)).rejects.toThrow(/id debe ser/);
    await expect(alertaService.atenderAlerta(3, null)).rejects.toThrow(/usuarioId/);
    expect(repo.atenderAlerta).not.toHaveBeenCalled();
  });
});
