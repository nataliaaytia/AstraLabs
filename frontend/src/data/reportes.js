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
