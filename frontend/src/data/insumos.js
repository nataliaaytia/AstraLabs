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

const PRIORIDAD_ESTADO = {
    inexistente: 0,
    "sin-stock": 1,
    falta: 2,
    "bajo-minimo": 3,
    suficiente: 4,
};

export function calcularInsumos(
    planes,
    inventario,
    stock = stockUtilizable(inventario)
) {
    const requeridos = new Map();

    for (const plan of planes) {
        for (const ingrediente of plan.ingredientes || []) {
            const id = String(ingrediente.articuloId);
            const actual = requeridos.get(id) || { necesario: 0, planes: [] };

            requeridos.set(id, {
                necesario: redondear(
                    actual.necesario + Number(ingrediente.cantidad)
                ),
                planes: actual.planes.includes(plan.nombre)
                    ? actual.planes
                    : [...actual.planes, plan.nombre],
            });
        }
    }

    return [...requeridos.entries()]
        .map(([id, { necesario, planes: usadoEn }]) => {
            const articulo = inventario.find((a) => String(a.id) === id);
            const disponible = stock.utilizable.get(id) || 0;
            const minimo = Number(articulo?.stock_minimo) || 0;
            const faltante = redondear(Math.max(0, necesario - disponible));
            const restante = redondear(Math.max(0, disponible - necesario));
            const reponer = redondear(
                Math.max(0, necesario + minimo - disponible)
            );

            let estado = "suficiente";

            if (!articulo) estado = "inexistente";
            else if (faltante > 0 && disponible === 0) estado = "sin-stock";
            else if (faltante > 0) estado = "falta";
            else if (minimo > 0 && restante < minimo) estado = "bajo-minimo";

            return {
                articuloId: id,
                nombre: articulo?.nombre || "Artículo eliminado",
                categoria: articulo?.categoria || "",
                unidad: articulo?.unidad_medida || "",
                necesario,
                disponible,
                vencido: stock.vencido.get(id) || 0,
                minimo,
                faltante,
                restante,
                reponer,
                usadoEn,
                porcentaje: necesario > 0
                    ? Math.min(100, Math.round((disponible / necesario) * 100))
                    : 100,
                estado,
            };
        })
        .sort((a, b) =>
            PRIORIDAD_ESTADO[a.estado] - PRIORIDAD_ESTADO[b.estado] ||
            b.reponer - a.reponer ||
            a.nombre.localeCompare(b.nombre)
        );
}

export function resumirPlanes(planes, inventario) {
    const stock = stockUtilizable(inventario);

    return planes.map((plan) => {
        const insumos = calcularInsumos([plan], inventario, stock);
        const faltantes = insumos.filter((i) => i.faltante > 0).length;

        return {
            ...plan,
            totalInsumos: insumos.length,
            faltantes,
            listo: insumos.length > 0 && faltantes === 0,
        };
    });
}
