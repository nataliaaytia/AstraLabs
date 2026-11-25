import { obtenerLotes } from "./lotes";

export const ESTADOS_PENDIENTES = ["borrador", "confirmado"];

function redondear(valor) {
    return Number(Number(valor).toFixed(3));
}

export function stockUtilizable(inventario) {
    const hoy = new Date().toLocaleDateString("en-CA");
    const lotes = obtenerLotes(inventario);
    const utilizable = new Map();
    const vencido = new Map();

    for (const lote of lotes) {
        const id = String(lote.articuloId);
        const cantidad = Number(lote.cantidadDisponible) || 0;
        const destino = lote.fechaVencimiento && lote.fechaVencimiento < hoy
            ? vencido
            : utilizable;

        destino.set(id, redondear((destino.get(id) || 0) + cantidad));
    }

    return { utilizable, vencido };
}

export function calcularInsumos(planes, inventario) {
    const requeridos = new Map();

    for (const plan of planes) {
        for (const ingrediente of plan.ingredientes || []) {
            const id = String(ingrediente.articuloId);

            requeridos.set(
                id,
                redondear(
                    (requeridos.get(id) || 0) + Number(ingrediente.cantidad)
                )
            );
        }
    }

    const { utilizable, vencido } = stockUtilizable(inventario);

    return [...requeridos.entries()]
        .map(([id, necesario]) => {
            const articulo = inventario.find((a) => String(a.id) === id);
            const disponible = utilizable.get(id) || 0;
            const faltante = redondear(Math.max(0, necesario - disponible));

            return {
                articuloId: id,
                nombre: articulo?.nombre || "Artículo eliminado",
                unidad: articulo?.unidad_medida || "",
                necesario,
                disponible,
                vencido: vencido.get(id) || 0,
                faltante,
                porcentaje: necesario > 0
                    ? Math.min(100, Math.round((disponible / necesario) * 100))
                    : 100,
                estado: !articulo
                    ? "inexistente"
                    : faltante === 0
                        ? "suficiente"
                        : disponible === 0
                            ? "sin-stock"
                            : "falta",
            };
        })
        .sort((a, b) =>
            b.faltante - a.faltante || a.nombre.localeCompare(b.nombre)
        );
}
