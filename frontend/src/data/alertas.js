// Helpers puros para mostrar las alertas que entrega el backend (/api/alertas).
// Las alertas, su estado (pendiente/atendida) y el umbral de anticipación
// viven en la base de datos; aquí solo se normalizan para la pantalla.

export const OPCIONES_ANTICIPACION = [3, 5, 7, 15, 30];

export const NOMBRES_NIVEL = {
    vencido: "Vencido",
    urgente: "Urgente",
    proximo: "Próximo a vencer",
    agotado: "Agotado",
    critico: "Crítico",
    minimo: "En stock mínimo",
};

const PRIORIDAD = {
    vencido: 0,
    agotado: 1,
    urgente: 2,
    critico: 3,
    proximo: 4,
    minimo: 5,
};

export function textoDias(dias) {
    if (dias < 0) {
        return `Venció hace ${Math.abs(dias)} día(s)`;
    }

    if (dias === 0) return "Vence hoy";
    if (dias === 1) return "Vence mañana";

    return `Vence en ${dias} días`;
}

function nivelDe(alerta) {
    if (alerta.tipo === "vencimiento") {
        const dias = Number(alerta.dias_restantes);

        return dias < 0 ? "vencido" : dias <= 2 ? "urgente" : "proximo";
    }

    const actual = Number(alerta.stock_actual) || 0;
    const minimo = Number(alerta.stock_minimo) || 0;

    return actual === 0
        ? "agotado"
        : actual <= minimo * 0.5
            ? "critico"
            : "minimo";
}

/**
 * Convierte una alerta del backend al formato que usan las pantallas.
 * `lotes` (opcional) es la lista de /api/lotes para mostrar la cantidad del lote.
 */
export function normalizarAlerta(a, lotes = []) {
    const esVencimiento = a.tipo === "vencimiento";
    const actual = Number(a.stock_actual) || 0;
    const minimo = Number(a.stock_minimo) || 0;
    const lote = esVencimiento
        ? lotes.find((l) => Number(l.id) === Number(a.lote_id))
        : null;

    return {
        id: a.id,
        tipo: esVencimiento ? "vencimiento" : "stock",
        nivel: nivelDe(a),
        estado: a.estado,
        articuloId: a.articulo_id,
        articulo: a.articulo,
        categoria: a.categoria,
        unidad: a.unidad_medida,
        codigoLote: a.numero_lote || "sin número",
        fechaVencimiento: a.fecha_vencimiento,
        dias: a.dias_restantes === null ? null : Number(a.dias_restantes),
        cantidad: lote ? Number(lote.cantidadDisponible) : null,
        actual,
        minimo,
        faltante: Number(Math.max(minimo - actual, 0).toFixed(2)),
        fechaAtendida: a.fecha_atendida,
        // null = el sistema la cerró sola porque la situación ya se resolvió.
        atendidaPor: a.atendida_por,
    };
}

export function ordenarAlertas(alertas) {
    return [...alertas].sort(
        (a, b) =>
            PRIORIDAD[a.nivel] - PRIORIDAD[b.nivel] ||
            a.articulo.localeCompare(b.articulo)
    );
}
