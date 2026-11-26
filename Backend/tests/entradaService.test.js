jest.mock("../src/repositories/inventarioRepository");

const repo = require("../src/repositories/inventarioRepository");
const entradaService = require("../src/services/entradaService");

const ARROZ = { id: 5, nombre: "Arroz", es_perecedero: false, categoria: "Alimentos" };
const LECHE = { id: 6, nombre: "Leche", es_perecedero: true, categoria: "Alimentos" };
const PARACETAMOL = { id: 7, nombre: "Paracetamol", es_perecedero: false, categoria: "Medicinas" };

const base = { usuarioId: 2, fecha: "2026-11-23" };

beforeEach(() => {
  jest.resetAllMocks();
  repo.obtenerArticulosParaEntrada.mockResolvedValue([ARROZ, LECHE, PARACETAMOL]);
  repo.registrarEntradasEnLote.mockImplementation(async ({ items }) =>
    items.map((i, n) => ({ movimientoId: n + 1, loteId: n + 10, articuloId: i.articuloId, cantidadTotal: i.cantidad })),
  );
});

describe("Entradas — datos básicos (RF-02)", () => {
  test("registra una entrada simple de un no perecedero sin lote", async () => {
    const r = await entradaService.registrarEntrada({ ...base, articuloId: 5, cantidad: 20 });
    expect(r).toMatchObject({ movimientoId: 1, loteId: 10, advertencias: [] });
    expect(repo.registrarEntradasEnLote).toHaveBeenCalledWith(
      expect.objectContaining({ donanteId: null, items: [expect.objectContaining({ articuloId: 5, cantidad: 20, observaciones: null })] }),
    );
  });

  test("rechaza datos obligatorios faltantes", async () => {
    await expect(entradaService.registrarEntrada({ cantidad: 1, usuarioId: 2 })).rejects.toThrow("articuloId es obligatorio");
    await expect(entradaService.registrarEntrada({ articuloId: 5, cantidad: 1 })).rejects.toThrow("usuarioId es obligatorio");
    await expect(entradaService.registrarEntrada({ articuloId: 5, cantidad: 0, usuarioId: 2 })).rejects.toThrow("La cantidad debe ser mayor a cero");
    await expect(entradaService.registrarEntrada({ articuloId: 5, cantidad: -3, usuarioId: 2 })).rejects.toThrow("La cantidad debe ser mayor a cero");
    expect(repo.registrarEntradasEnLote).not.toHaveBeenCalled();
  });

  test("artículo inexistente", async () => {
    await expect(entradaService.registrarEntrada({ ...base, articuloId: 999, cantidad: 1 })).rejects.toThrow("El artículo no existe");
  });
});

describe("RF-04 — perecederos y medicinas exigen vencimiento y lote", () => {
  test("perecedero sin vencimiento ni lote", async () => {
    await expect(entradaService.registrarEntrada({ ...base, articuloId: 6, cantidad: 3 })).rejects.toThrow(
      /Leche es perecedero o medicina: la fecha de vencimiento y el número de lote son obligatorios/,
    );
    expect(repo.registrarEntradasEnLote).not.toHaveBeenCalled();
  });

  test("perecedero con solo uno de los dos datos", async () => {
    await expect(
      entradaService.registrarEntrada({ ...base, articuloId: 6, cantidad: 3, numeroLote: "L1" }),
    ).rejects.toThrow(/la fecha de vencimiento es obligatoria/);
    await expect(
      entradaService.registrarEntrada({ ...base, articuloId: 6, cantidad: 3, fechaVencimiento: "2027-01-01" }),
    ).rejects.toThrow(/el número de lote es obligatorio/);
  });

  test("una medicina (categoría Medicinas) también lo exige aunque no sea perecedero", async () => {
    await expect(entradaService.registrarEntrada({ ...base, articuloId: 7, cantidad: 2 })).rejects.toThrow(/Paracetamol/);
    const r = await entradaService.registrarEntrada({
      ...base, articuloId: 7, cantidad: 2, numeroLote: "MED-1", fechaVencimiento: "2027-06-30",
    });
    expect(r.advertencias).toEqual([]);
  });

  test("en la donación múltiple el error indica el ítem", async () => {
    await expect(
      entradaService.registrarEntradasEnLote({
        ...base,
        items: [{ articuloId: 5, cantidad: 1 }, { articuloId: 6, cantidad: 1 }],
      }),
    ).rejects.toThrow(/^ítem #2: Leche es perecedero/);
    expect(repo.registrarEntradasEnLote).not.toHaveBeenCalled();
  });

  test("formato de fecha inválido", async () => {
    await expect(
      entradaService.registrarEntrada({ ...base, articuloId: 6, cantidad: 1, numeroLote: "L", fechaVencimiento: "31/12/2027" }),
    ).rejects.toThrow(/fechaVencimiento debe tener formato YYYY-MM-DD/);
  });
});

describe("RF-04 — vencidos: 3 semanas en observación", () => {
  const item = (fechaVencimiento) => ({ ...base, articuloId: 6, cantidad: 4, numeroLote: "L9", fechaVencimiento });

  test("vencido hace 10 días: se acepta, queda en observación y avisa", async () => {
    const r = await entradaService.registrarEntrada(item("2026-11-13"));
    expect(r.advertencias).toHaveLength(1);
    expect(r.advertencias[0]).toMatch(/Leche.*10 día.*observación/);
    const llamado = repo.registrarEntradasEnLote.mock.calls[0][0];
    expect(llamado.items[0].observaciones).toMatch(/^En observación: lote vencido hace 10 día/);
  });

  test("límite: 21 días se acepta, 22 se rechaza", async () => {
    await expect(entradaService.registrarEntrada(item("2026-11-02"))).resolves.toBeTruthy();
    await expect(entradaService.registrarEntrada(item("2026-11-01"))).rejects.toThrow(/venció hace 22 días.*21 días/);
  });

  test("vigente: sin advertencias ni observación", async () => {
    const r = await entradaService.registrarEntrada(item("2027-01-01"));
    expect(r.advertencias).toEqual([]);
    expect(repo.registrarEntradasEnLote.mock.calls[0][0].items[0].observaciones).toBeNull();
  });

  test("también se evalúa un no perecedero que trae fecha de vencimiento", async () => {
    await expect(
      entradaService.registrarEntrada({ ...base, articuloId: 5, cantidad: 1, fechaVencimiento: "2020-01-01" }),
    ).rejects.toThrow(/venció hace/);
  });
});

describe("Errores de base de datos", () => {
  test("FK y lote duplicado", async () => {
    repo.registrarEntradasEnLote.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "23503" }));
    await expect(entradaService.registrarEntrada({ ...base, articuloId: 5, cantidad: 1 })).rejects.toThrow("El artículo o el donante no existe");
    repo.registrarEntradasEnLote.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "23505" }));
    await expect(entradaService.registrarEntrada({ ...base, articuloId: 5, cantidad: 1 })).rejects.toThrow(/lote con ese número/);
  });
});
