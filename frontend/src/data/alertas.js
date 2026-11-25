import { obtenerLotes } from "./lotes";

const CLAVE_CONFIGURACION = "amandita_config_alertas_v1";

export const DIAS_ANTICIPACION_DEFECTO = 7;

function leerJSON(clave, valorDefecto) {
    try {
        const datos = localStorage.getItem(clave);
        return datos ? JSON.parse(datos) : valorDefecto;
    } catch {
        return valorDefecto;
    }
}

function hoyLocal() {
    return new Date().toLocaleDateString("en-CA");
}

export function diasHasta(fecha) {
    if (!fecha) return null;

    const [anio, mes, dia] = fecha.split("-").map(Number);
    const [a, m, d] = hoyLocal().split("-").map(Number);

    return Math.round(
        (Date.UTC(anio, mes - 1, dia) - Date.UTC(a, m - 1, d)) /
        86400000
    );
}

export function cargarConfiguracion() {
    const config = leerJSON(CLAVE_CONFIGURACION, {});
    const dias = Number(config.diasAnticipacion);

    return {
        diasAnticipacion:
            Number.isInteger(dias) && dias >= 1 && dias <= 90
                ? dias
                : DIAS_ANTICIPACION_DEFECTO,
    };
}

export function alertasVencimiento(inventario, diasAnticipacion) {
    const lotes = obtenerLotes(inventario);

    return lotes
        .filter(
            (lote) =>
                lote.fechaVencimiento &&
                Number(lote.cantidadDisponible) > 0
        )
        .map((lote) => ({
            lote,
            dias: diasHasta(lote.fechaVencimiento),
            articulo: inventario.find(
                (a) => String(a.id) === String(lote.articuloId)
            ),
        }))
        .filter(({ dias, articulo }) =>
            articulo && dias <= diasAnticipacion
        )
        .map(({ lote, dias, articulo }) => {
            const nivel = dias < 0
                ? "vencido"
                : dias <= 2
                    ? "urgente"
                    : "proximo";

            return {
                id: `vencimiento-${lote.id}-${nivel}`,
                tipo: "vencimiento",
                nivel,
                articuloId: articulo.id,
                articulo: articulo.nombre,
                categoria: articulo.categoria,
                codigoLote: lote.codigo,
                fechaVencimiento: lote.fechaVencimiento,
                dias,
                cantidad: Number(lote.cantidadDisponible),
                unidad: articulo.unidad_medida,
            };
        });
}

export function textoDias(dias) {
    if (dias < 0) {
        return `Venció hace ${Math.abs(dias)} día(s)`;
    }

    if (dias === 0) return "Vence hoy";
    if (dias === 1) return "Vence mañana";

    return `Vence en ${dias} días`;
}
