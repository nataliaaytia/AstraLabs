const { descontarPorFEFO } = require("./fefoService");

describe("Gestor de Inventario y FEFO (RF-05, RF-20)", () => {
  test("descuenta primero del lote con fecha de vencimiento mas proxima", () => {
    const lotes = [
      { id: 1, cantidad_disponible: 10, fecha_vencimiento: "2026-12-01" },
      { id: 2, cantidad_disponible: 10, fecha_vencimiento: "2026-10-20" }, // vence antes
    ];

    const movimientos = descontarPorFEFO(lotes, 5);

    expect(movimientos).toEqual([{ lote_id: 2, cantidad_descontada: 5 }]);
  });

  test("reparte el descuento entre varios lotes cuando el mas proximo no alcanza", () => {
    const lotes = [
      { id: 1, cantidad_disponible: 10, fecha_vencimiento: "2026-12-01" },
      { id: 2, cantidad_disponible: 3, fecha_vencimiento: "2026-10-20" },
    ];

    const movimientos = descontarPorFEFO(lotes, 5);

    expect(movimientos).toEqual([
      { lote_id: 2, cantidad_descontada: 3 },
      { lote_id: 1, cantidad_descontada: 2 },
    ]);
  });

  test("rechaza la operacion si el stock total es insuficiente", () => {
    const lotes = [
      { id: 1, cantidad_disponible: 2, fecha_vencimiento: "2026-12-01" },
    ];

    expect(() => descontarPorFEFO(lotes, 5)).toThrow("Stock insuficiente");
  });

  test("consume los lotes sin fecha de vencimiento al final", () => {
    const lotes = [
      { id: 1, cantidad_disponible: 5, fecha_vencimiento: null }, // no perecedero
      { id: 2, cantidad_disponible: 5, fecha_vencimiento: "2026-10-20" },
    ];

    const movimientos = descontarPorFEFO(lotes, 7);

    expect(movimientos).toEqual([
      { lote_id: 2, cantidad_descontada: 5 },
      { lote_id: 1, cantidad_descontada: 2 },
    ]);
  });
});
