const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

/**
 * Generador común de archivos (RF-24): arma el Excel o el PDF de cualquier
 * pantalla a partir de una definición (título, columnas, filas y filtros),
 * para que cada exportación solo describa SU contenido.
 */

const ZONA = "America/La_Paz";

const FORMATOS = {
  xlsx: {
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  },
  pdf: { contentType: "application/pdf", extension: "pdf" },
};

function validarFormato(formato) {
  if (!Object.prototype.hasOwnProperty.call(FORMATOS, formato)) {
    throw new Error("formato debe ser 'xlsx' o 'pdf'");
  }
  return formato;
}

function fechaHoraLaPaz(fecha = new Date()) {
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
}

function fechaIsoLaPaz(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

function textoCelda(valor, columna) {
  if (valor === null || valor === undefined || valor === "") return "";
  if (columna.tipo === "numero") {
    return Number(valor).toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  }
  if (columna.tipo === "entero") {
    return Number(valor).toLocaleString("es-BO", { maximumFractionDigits: 0 });
  }
  return String(valor);
}

// ---------------------------------------------------------------- Excel

async function generarExcel({ titulo, hoja, columnas, filas, filtros, generado }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AstraLabs - Casa Amandita del Adulto Mayor";
  const ws = wb.addWorksheet(hoja.slice(0, 31));
  const n = columnas.length;
  const FILA_ENCABEZADO = 6;

  const meta = (fila, texto, opciones = {}) => {
    if (n > 1) ws.mergeCells(fila, 1, fila, n);
    const celda = ws.getCell(fila, 1);
    celda.value = texto;
    celda.font = opciones.font || { size: 10 };
    celda.alignment = { vertical: "middle", wrapText: true };
  };
  meta(1, titulo, { font: { bold: true, size: 14 } });
  meta(2, `Generado: ${generado}`);
  meta(3, `Filtros: ${filtros}`);
  meta(4, `Total de registros: ${filas.length}`);

  columnas.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.ancho ?? 18;
  });

  const encabezado = ws.getRow(FILA_ENCABEZADO);
  encabezado.values = columnas.map((c) => c.titulo);
  encabezado.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3B5B8C" },
    };
    celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  if (filas.length === 0) {
    const fila = FILA_ENCABEZADO + 1;
    if (n > 1) ws.mergeCells(fila, 1, fila, n);
    ws.getCell(fila, 1).value = "Sin registros para los filtros aplicados.";
    ws.getCell(fila, 1).font = { italic: true };
  } else {
    for (const f of filas) {
      const fila = ws.addRow(columnas.map((c) => f[c.clave] ?? null));
      fila.eachCell({ includeEmpty: true }, (celda, col) => {
        const c = columnas[col - 1];
        celda.alignment = {
          vertical: "top",
          wrapText: true,
          horizontal: c.tipo ? "right" : "left",
        };
        if (c.tipo === "numero") celda.numFmt = "#,##0.00#";
        if (c.tipo === "entero") celda.numFmt = "#,##0";
      });
    }
    ws.autoFilter = {
      from: { row: FILA_ENCABEZADO, column: 1 },
      to: { row: FILA_ENCABEZADO + filas.length, column: n },
    };
  }

  ws.views = [{ state: "frozen", ySplit: FILA_ENCABEZADO }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ------------------------------------------------------------------ PDF

function generarPDF({
  titulo,
  columnas,
  filas,
  filtros,
  generado,
  agruparColumnas = [],
  orientacion = "portrait",
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: orientacion,
      margin: 40,
      bufferPages: true,
      info: { Title: titulo, Author: "AstraLabs" },
    });
    const partes = [];
    doc.on("data", (p) => partes.push(p));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);

    try {
      const margen = 40;
      const ancho = doc.page.width - margen * 2;
      const pesoTotal = columnas.reduce((s, c) => s + (c.ancho ?? 18), 0);
      const anchos = columnas.map((c) => ((c.ancho ?? 18) / pesoTotal) * ancho);
      const pad = 4;
      const limiteY = () => doc.page.height - doc.page.margins.bottom - 20;

      doc.font("Helvetica-Bold").fontSize(16).text(titulo, margen, margen, { width: ancho });
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(9).fillColor("#444444");
      doc.text(`Generado: ${generado}`, { width: ancho });
      doc.text(`Filtros: ${filtros}`, { width: ancho });
      doc.text(`Total de registros: ${filas.length}`, { width: ancho });
      doc.fillColor("#000000");

      let y = doc.y + 12;

      const dibujarEncabezado = () => {
        doc.font("Helvetica-Bold").fontSize(10);
        const alto =
          Math.max(
            ...columnas.map((c, i) =>
              doc.heightOfString(c.titulo, { width: anchos[i] - pad * 2 }),
            ),
          ) +
          pad * 2;
        doc.rect(margen, y, ancho, alto).fill("#3B5B8C");
        doc.fillColor("#FFFFFF");
        let x = margen;
        columnas.forEach((c, i) => {
          doc.text(c.titulo, x + pad, y + pad, {
            width: anchos[i] - pad * 2,
            align: "left",
          });
          x += anchos[i];
        });
        doc.fillColor("#000000");
        y += alto;
      };

      dibujarEncabezado();

      if (filas.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(10);
        doc.text("Sin registros para los filtros aplicados.", margen + pad, y + 8, {
          width: ancho,
        });
      }

      const anterior = {};
      filas.forEach((f, idx) => {
        const valores = columnas.map((c) => {
          const texto = textoCelda(f[c.clave], c);
          if (agruparColumnas.includes(c.clave)) {
            if (anterior[c.clave] === texto && idx > 0) return "";
            anterior[c.clave] = texto;
          }
          return texto;
        });

        doc.font("Helvetica").fontSize(10);
        const alto =
          Math.max(
            ...valores.map((v, i) =>
              doc.heightOfString(v || " ", { width: anchos[i] - pad * 2 }),
            ),
          ) +
          pad * 2;

        if (y + alto > limiteY()) {
          doc.addPage();
          y = doc.page.margins.top;
          dibujarEncabezado();
          doc.font("Helvetica").fontSize(10);
        }

        if (idx % 2 === 1) doc.rect(margen, y, ancho, alto).fill("#F1F4F9");
        doc.fillColor("#000000");

        let x = margen;
        valores.forEach((v, i) => {
          doc.text(v, x + pad, y + pad, {
            width: anchos[i] - pad * 2,
            align: columnas[i].tipo ? "right" : "left",
          });
          x += anchos[i];
        });
        y += alto;
      });

      // Número de página en el pie de cada hoja
      const rango = doc.bufferedPageRange();
      for (let i = 0; i < rango.count; i++) {
        doc.switchToPage(rango.start + i);
        const margenInferior = doc.page.margins.bottom;
        doc.page.margins.bottom = 0; // evita que el pie genere una página nueva
        doc.font("Helvetica").fontSize(8).fillColor("#666666");
        doc.text(
          `Página ${i + 1} de ${rango.count}`,
          margen,
          doc.page.height - 30,
          { width: ancho, align: "center" },
        );
        doc.page.margins.bottom = margenInferior;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ------------------------------------------------------------- Público

/**
 * @param {"xlsx"|"pdf"} formato
 * @param {object} definicion
 * @param {string} definicion.titulo
 * @param {string} definicion.hoja            nombre de la hoja de Excel
 * @param {string} definicion.nombreBase      prefijo del archivo, p. ej. "articulos"
 * @param {Array<{clave:string,titulo:string,ancho?:number,tipo?:"numero"|"entero"}>} definicion.columnas
 * @param {object[]} definicion.filas
 * @param {string} definicion.filtros         descripción legible de los filtros aplicados
 * @param {string[]} [definicion.agruparColumnas]  columnas que en el PDF no repiten su valor consecutivo
 * @param {"portrait"|"landscape"} [definicion.orientacion]
 * @returns {Promise<{buffer:Buffer,contentType:string,nombreArchivo:string}>}
 */
async function generarArchivo(formato, definicion) {
  validarFormato(formato);
  const ahora = new Date();
  const datos = {
    ...definicion,
    filtros: definicion.filtros || "Sin filtros",
    generado: fechaHoraLaPaz(ahora),
  };
  const buffer =
    formato === "xlsx" ? await generarExcel(datos) : await generarPDF(datos);
  return {
    buffer,
    contentType: FORMATOS[formato].contentType,
    nombreArchivo: `${definicion.nombreBase}_${fechaIsoLaPaz(ahora)}.${FORMATOS[formato].extension}`,
  };
}

module.exports = { generarArchivo, validarFormato };
