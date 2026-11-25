import { obtenerLotes } from "./lotes";
import { NOMBRES_NIVEL, generarAlertas, textoDias } from "./alertas";

export const TIPOS_REPORTE = [
    {
        valor: "inventario",
        titulo: "Inventario actual",
        descripcion: "Existencias y estado de cada artículo.",
    },
    {
        valor: "movimientos",
        titulo: "Movimientos",
        descripcion: "Salidas, mermas, donaciones y preparaciones.",
        usaFechas: true,
    },
    {
        valor: "lotes",
        titulo: "Lotes y vencimientos",
        descripcion: "Lotes con existencias y su fecha de vencimiento.",
    },
    {
        valor: "necesidades",
        titulo: "Necesidades críticas",
        descripcion: "Artículos por debajo de su stock mínimo.",
    },
    {
        valor: "alertas",
        titulo: "Alertas activas",
        descripcion: "Vencimientos próximos y stock mínimo.",
    },
];

const NOMBRES_MOVIMIENTO = {
    salida: "Salida",
    merma: "Merma",
    donacion: "Donación",
    preparacion_plan: "Preparación",
};

function numero(valor) {
    return Number(Number(valor || 0).toFixed(3));
}

function fechaCorta(fecha) {
    return fecha ? String(fecha).slice(0, 10) : "";
}

function reporteInventario(inventario) {
    return {
        columnas: [
            "Artículo",
            "Categoría",
            "Unidad",
            "Stock actual",
            "Stock mínimo",
            "Estado",
        ],
        filas: inventario.map((a) => {
            const actual = numero(a.stock_actual);
            const minimo = numero(a.stock_minimo);

            return [
                a.nombre,
                a.categoria || "",
                a.unidad_medida || "",
                actual,
                minimo,
                !minimo
                    ? "Sin mínimo"
                    : actual <= minimo
                        ? "Stock bajo"
                        : "Disponible",
            ];
        }),
    };
}

function reporteMovimientos(movimientos, desde, hasta) {
    const filas = [];

    movimientos
        .filter((m) => {
            const fecha = fechaCorta(m.fecha);
            return (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
        })
        .forEach((m) => {
            const tipo = NOMBRES_MOVIMIENTO[m.tipo] || m.tipo;

            if (m.tipo === "preparacion_plan") {
                (m.ingredientes || []).forEach((i) => {
                    filas.push([
                        fechaCorta(m.fecha),
                        tipo,
                        i.articulo,
                        numero(i.cantidad),
                        `Plan: ${m.plan}`,
                    ]);
                });
                return;
            }

            filas.push([
                fechaCorta(m.fecha),
                tipo,
                m.articulo,
                numero(m.cantidad),
                m.destino || m.motivo || m.donante || "",
            ]);
        });

    return {
        columnas: ["Fecha", "Tipo", "Artículo", "Cantidad", "Detalle"],
        filas,
    };
}

function reporteLotes(inventario) {
    const hoy = new Date().toLocaleDateString("en-CA");

    return {
        columnas: ["Artículo", "Lote", "Vencimiento", "Cantidad", "Estado"],
        filas: obtenerLotes(inventario)
            .filter((l) => Number(l.cantidadDisponible) > 0)
            .sort((a, b) =>
                (a.fechaVencimiento || "9999").localeCompare(
                    b.fechaVencimiento || "9999"
                )
            )
            .map((l) => {
                const articulo = inventario.find(
                    (a) => String(a.id) === String(l.articuloId)
                );

                return [
                    articulo?.nombre || "",
                    l.codigo,
                    l.fechaVencimiento || "Sin fecha",
                    `${numero(l.cantidadDisponible)} ${articulo?.unidad_medida || ""}`,
                    !l.fechaVencimiento
                        ? "Sin fecha"
                        : l.fechaVencimiento < hoy
                            ? "Vencido"
                            : "Vigente",
                ];
            }),
    };
}

function reporteNecesidades(inventario) {
    return {
        columnas: ["Artículo", "Disponible", "Mínimo", "Faltante", "Unidad"],
        filas: inventario
            .filter((a) =>
                numero(a.stock_minimo) > 0 &&
                numero(a.stock_actual) < numero(a.stock_minimo)
            )
            .map((a) => [
                a.nombre,
                numero(a.stock_actual),
                numero(a.stock_minimo),
                numero(a.stock_minimo - a.stock_actual),
                a.unidad_medida || "",
            ])
            .sort((a, b) => b[3] - a[3]),
    };
}

function reporteAlertas(inventario) {
    return {
        columnas: ["Tipo", "Nivel", "Artículo", "Detalle"],
        filas: generarAlertas(inventario).map((a) => [
            a.tipo === "vencimiento" ? "Vencimiento" : "Stock mínimo",
            NOMBRES_NIVEL[a.nivel],
            a.articulo,
            a.tipo === "vencimiento"
                ? `Lote ${a.codigoLote} · ${textoDias(a.dias)}`
                : `Disponible ${a.actual} de ${a.minimo} ${a.unidad}`,
        ]),
    };
}

export function construirReporte(tipo, datos, filtros = {}) {
    const info = TIPOS_REPORTE.find((t) => t.valor === tipo);

    if (!info) {
        throw new Error("Selecciona un tipo de reporte válido.");
    }

    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
        throw new Error("La fecha inicial no puede ser mayor a la final.");
    }

    const constructores = {
        inventario: () => reporteInventario(datos.inventario),
        movimientos: () => reporteMovimientos(
            datos.movimientos,
            filtros.desde,
            filtros.hasta
        ),
        lotes: () => reporteLotes(datos.inventario),
        necesidades: () => reporteNecesidades(datos.inventario),
        alertas: () => reporteAlertas(datos.inventario),
    };

    return {
        titulo: info.titulo,
        generado: new Date().toLocaleString("es-BO"),
        periodo: info.usaFechas && (filtros.desde || filtros.hasta)
            ? `${filtros.desde || "inicio"} al ${filtros.hasta || "hoy"}`
            : null,
        ...constructores[tipo](),
    };
}

function escapar(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function nombreArchivo(reporte, extension) {
    const base = reporte.titulo
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");

    return `casa-amandita-${base}-${new Date().toLocaleDateString("en-CA")}.${extension}`;
}

function tablaHTML(reporte) {
    return `
        <table>
            <thead>
                <tr>${reporte.columnas.map((c) => `<th>${escapar(c)}</th>`).join("")}</tr>
            </thead>
            <tbody>
                ${reporte.filas.map((fila) =>
        `<tr>${fila.map((celda) => `<td>${escapar(celda)}</td>`).join("")}</tr>`
    ).join("")}
            </tbody>
        </table>`;
}

function validarExportable(reporte) {
    if (!reporte || reporte.filas.length === 0) {
        throw new Error("No hay registros para exportar.");
    }
}

export function exportarExcel(reporte) {
    validarExportable(reporte);

    const contenido = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
            <meta charset="UTF-8" />
            <style>
                th { background: #737D61; color: #FFFFFF; font-weight: bold; }
                td, th { border: 1px solid #EFE3D3; padding: 6px; }
            </style>
        </head>
        <body>
            <h2>Casa Amandita · ${escapar(reporte.titulo)}</h2>
            <p>Generado: ${escapar(reporte.generado)}${reporte.periodo ? ` · Periodo: ${escapar(reporte.periodo)}` : ""}</p>
            ${tablaHTML(reporte)}
        </body>
        </html>`;

    const blob = new Blob(["﻿", contenido], {
        type: "application/vnd.ms-excel;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = nombreArchivo(reporte, "xls");
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportarPDF(reporte) {
    validarExportable(reporte);

    const marco = document.createElement("iframe");

    marco.style.position = "fixed";
    marco.style.width = "0";
    marco.style.height = "0";
    marco.style.border = "0";
    marco.setAttribute("aria-hidden", "true");
    document.body.appendChild(marco);

    const documento = marco.contentWindow.document;

    documento.open();
    documento.write(`
        <!doctype html>
        <html lang="es">
        <head>
            <meta charset="UTF-8" />
            <title>${escapar(nombreArchivo(reporte, "pdf"))}</title>
            <style>
                @page { margin: 18mm 14mm; }
                body { font-family: "DM Sans", Arial, sans-serif; color: #51483E; }
                .marca { font-size: 10px; letter-spacing: 2px; color: #737D61; font-weight: bold; }
                h1 { font-family: Georgia, serif; font-weight: 400; font-size: 26px; margin: 8px 0 4px; }
                p { font-size: 11px; color: #7B766D; margin: 0 0 16px; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th { background: #737D61; color: white; text-align: left; padding: 8px; }
                td { padding: 7px 8px; border-bottom: 1px solid #EFE3D3; }
                tr:nth-child(even) td { background: #FCF8F3; }
                .pie { margin-top: 18px; font-size: 10px; color: #A5AA94; text-align: center; }
            </style>
        </head>
        <body>
            <span class="marca">✦ CASA AMANDITA · DEL ADULTO MAYOR</span>
            <h1>${escapar(reporte.titulo)}</h1>
            <p>
                Generado: ${escapar(reporte.generado)}
                ${reporte.periodo ? ` · Periodo: ${escapar(reporte.periodo)}` : ""}
                · ${reporte.filas.length} registro(s)
            </p>
            ${tablaHTML(reporte)}
            <div class="pie">Organizando recursos, cuidando personas ♡</div>
        </body>
        </html>`);
    documento.close();

    const imprimir = () => {
        marco.contentWindow.focus();
        marco.contentWindow.print();
        setTimeout(() => marco.remove(), 1000);
    };

    if (documento.readyState === "complete") {
        setTimeout(imprimir, 100);
    } else {
        marco.onload = imprimir;
    }
}
