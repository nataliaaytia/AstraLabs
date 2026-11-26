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

export function alertasStockMinimo(inventario) {
    return inventario
        .map((articulo) => ({
            articulo,
            actual: Number(articulo.stock_actual) || 0,
            minimo: Number(articulo.stock_minimo) || 0,
        }))
        .filter(({ actual, minimo }) => minimo > 0 && actual <= minimo)
        .map(({ articulo, actual, minimo }) => {
            const nivel = actual === 0
                ? "agotado"
                : actual <= minimo * 0.5
                    ? "critico"
                    : "minimo";

            return {
                id: `stock-${articulo.id}-${nivel}`,
                tipo: "stock",
                nivel,
                articuloId: articulo.id,
                articulo: articulo.nombre,
                categoria: articulo.categoria,
                actual,
                minimo,
                faltante: Number((minimo - actual).toFixed(3)),
                unidad: articulo.unidad_medida,
            };
        });
}

const PRIORIDAD = {
    vencido: 0,
    agotado: 1,
    urgente: 2,
    critico: 3,
    proximo: 4,
    minimo: 5,
};

export function generarAlertas(inventario, configuracion = cargarConfiguracion()) {
    return [
        ...alertasVencimiento(inventario, configuracion.diasAnticipacion),
        ...alertasStockMinimo(inventario),
    ].sort((a, b) =>
        PRIORIDAD[a.nivel] - PRIORIDAD[b.nivel] ||
        a.articulo.localeCompare(b.articulo)
    );
}

export const NOMBRES_NIVEL = {
    vencido: "Vencido",
    urgente: "Urgente",
    proximo: "Próximo a vencer",
    agotado: "Agotado",
    critico: "Crítico",
    minimo: "En stock mínimo",
};

const CLAVE_ATENDIDAS = "amandita_alertas_atendidas_v1";

export function cargarAtendidas() {
    const datos = leerJSON(CLAVE_ATENDIDAS, {});
    return datos && typeof datos === "object" && !Array.isArray(datos)
        ? datos
        : {};
}

function guardarAtendidas(atendidas) {
    localStorage.setItem(CLAVE_ATENDIDAS, JSON.stringify(atendidas));
}

export function depurarAtendidas(alertas) {
    const vigentes = new Set(alertas.map((a) => a.id));
    const atendidas = cargarAtendidas();

    const depuradas = Object.fromEntries(
        Object.entries(atendidas).filter(([id]) => vigentes.has(id))
    );

    if (Object.keys(depuradas).length !== Object.keys(atendidas).length) {
        guardarAtendidas(depuradas);
    }

    return depuradas;
}

export function marcarAtendida(alertaId, usuario) {
    const atendidas = cargarAtendidas();

    atendidas[alertaId] = {
        fecha: new Date().toISOString(),
        usuario: usuario || null,
    };

    guardarAtendidas(atendidas);
    return atendidas;
}

export function reactivarAlerta(alertaId) {
    const atendidas = cargarAtendidas();

    delete atendidas[alertaId];

    guardarAtendidas(atendidas);
    return atendidas;
}

export const OPCIONES_ANTICIPACION = [3, 5, 7, 15, 30];

export function guardarConfiguracion(datos) {
    const dias = Number(datos.diasAnticipacion);

    if (!OPCIONES_ANTICIPACION.includes(dias)) {
        throw new Error("Selecciona una anticipación válida.");
    }

    const configuracion = { diasAnticipacion: dias };

    localStorage.setItem(
        CLAVE_CONFIGURACION,
        JSON.stringify(configuracion)
    );

    return configuracion;
}
