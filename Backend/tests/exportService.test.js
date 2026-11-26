const ExcelJS = require("exceljs");
const { generarArchivo, validarFormato } = require("../src/services/exportService");

const columnas = [
  { clave: "nombre", titulo: "Artículo", ancho: 24 },
  { clave: "stock", titulo: "Stock", ancho: 12, tipo: "numero" },
];

const base = (filas) => ({
  titulo: "Reporte de prueba",
  hoja: "Prueba",
  nombreBase: "prueba",
  filtros: 'nombre contiene "arroz"',
  columnas,
  filas,
});

async function leerExcel(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets[0];
}

describe("exportService", () => {
  test("validarFormato acepta xlsx y pdf, rechaza lo demás", () => {
    expect(validarFormato("xlsx")).toBe("xlsx");
    expect(validarFormato("pdf")).toBe("pdf");
    expect(() => validarFormato("csv")).toThrow(/formato debe ser/);
    expect(() => validarFormato(undefined)).toThrow(/formato debe ser/);
    expect(() => validarFormato("constructor")).toThrow(/formato debe ser/);
  });

  test("Excel: título, filtros, encabezado y filas con números reales", async () => {
    const r = await generarArchivo(
      "xlsx",
      base([
        { nombre: "Arroz", stock: 76.8 },
        { nombre: "Azúcar", stock: 12 },
      ]),
    );
    expect(r.contentType).toMatch(/spreadsheetml/);
    expect(r.nombreArchivo).toMatch(/^prueba_\d{4}-\d{2}-\d{2}\.xlsx$/);

    const ws = await leerExcel(r.buffer);
    expect(ws.getCell("A1").value).toBe("Reporte de prueba");
    expect(ws.getCell("A2").value).toMatch(/^Generado: /);
    expect(ws.getCell("A3").value).toBe('Filtros: nombre contiene "arroz"');
    expect(ws.getCell("A4").value).toBe("Total de registros: 2");
    expect(ws.getCell("A6").value).toBe("Artículo");
    expect(ws.getCell("A7").value).toBe("Arroz");
    expect(ws.getCell("B7").value).toBe(76.8);
    expect(typeof ws.getCell("B8").value).toBe("number");
  });

  test("Excel sin filas deja el aviso y sin filtros dice 'Sin filtros'", async () => {
    const r = await generarArchivo("xlsx", { ...base([]), filtros: "" });
    const ws = await leerExcel(r.buffer);
    expect(ws.getCell("A3").value).toBe("Filtros: Sin filtros");
    expect(ws.getCell("A7").value).toMatch(/Sin registros/);
  });

  test("PDF válido, también vacío", async () => {
    const r = await generarArchivo("pdf", base([{ nombre: "Arroz", stock: 1 }]));
    expect(r.contentType).toBe("application/pdf");
    expect(r.nombreArchivo).toMatch(/\.pdf$/);
    expect(r.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.buffer.toString("latin1")).toMatch(/%%EOF\s*$/);

    const vacio = await generarArchivo("pdf", base([]));
    expect(vacio.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("PDF con muchas filas y texto largo pagina sin fallar", async () => {
    const filas = Array.from({ length: 250 }, (_, i) => ({
      nombre: `Artículo ${i} con un nombre bastante largo para forzar el salto de línea dentro de la celda`,
      stock: i * 1.5,
    }));
    const r = await generarArchivo("pdf", base(filas));
    const paginas = (r.buffer.toString("latin1").match(/\/Type \/Page\b(?!s)/g) || []).length;
    expect(paginas).toBeGreaterThan(3);
    expect(r.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("formato inválido lanza error", async () => {
    await expect(generarArchivo("doc", base([]))).rejects.toThrow(/formato debe ser/);
  });
});
