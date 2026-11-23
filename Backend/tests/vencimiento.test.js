const { evaluarVencimiento, DIAS_TOLERANCIA_VENCIMIENTO } = require("../src/utils/vencimiento");

describe("evaluarVencimiento (RF-04: tolerancia de 3 semanas)", () => {
  const rec = "2026-11-23";

  test("la tolerancia es de 21 días", () => {
    expect(DIAS_TOLERANCIA_VENCIMIENTO).toBe(21);
  });

  test("futuro o el mismo día de la recepción: vigente", () => {
    expect(evaluarVencimiento("2027-01-01", rec)).toEqual({ estado: "vigente", diasVencido: 0 });
    expect(evaluarVencimiento("2026-11-23", rec).estado).toBe("vigente");
  });

  test("vencido hace 1 a 21 días: en observación", () => {
    expect(evaluarVencimiento("2026-11-22", rec)).toEqual({ estado: "observacion", diasVencido: 1 });
    expect(evaluarVencimiento("2026-11-02", rec)).toEqual({ estado: "observacion", diasVencido: 21 });
  });

  test("vencido hace 22 días o más: rechazado", () => {
    expect(evaluarVencimiento("2026-11-01", rec)).toEqual({ estado: "rechazado", diasVencido: 22 });
  });

  test("cruza meses y años bisiestos correctamente", () => {
    expect(evaluarVencimiento("2024-02-20", "2024-03-12").estado).toBe("observacion"); // 21 días (bisiesto)
    expect(evaluarVencimiento("2023-02-20", "2023-03-12").estado).toBe("observacion"); // 20 días
    expect(evaluarVencimiento("2024-02-19", "2024-03-12").estado).toBe("rechazado"); // 22 días
  });

  test("sin fecha de recepción usa hoy (La Paz)", () => {
    expect(evaluarVencimiento("2099-01-01").estado).toBe("vigente");
    expect(evaluarVencimiento("2000-01-01").estado).toBe("rechazado");
  });

  test("formato inválido o fecha imposible", () => {
    expect(() => evaluarVencimiento("01/01/2027", rec)).toThrow(/fechaVencimiento debe tener formato/);
    expect(() => evaluarVencimiento("2026-02-31", rec)).toThrow(/fechaVencimiento debe tener formato/);
    expect(() => evaluarVencimiento("2027-01-01", "hoy")).toThrow(/fecha debe tener formato/);
  });
});
