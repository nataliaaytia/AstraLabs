import { inventarioApi } from "../services/inventarioApi";

export function validarMinimo(valor) {
    if (valor === "" || valor === null || valor === undefined) {
        throw new Error("Ingresa un stock mínimo.");
    }

    const numero = Number(valor);

    if (!Number.isFinite(numero) || numero < 0) {
        throw new Error("El stock mínimo no puede ser negativo.");
    }

    if (numero > 100000) {
        throw new Error("El stock mínimo es demasiado alto.");
    }

    // La base de datos guarda el mínimo con 2 decimales.
    return Number(numero.toFixed(2));
}

/**
 * Guarda los nuevos stocks mínimos en el backend (PATCH /api/articulos/:id).
 * Valida todo antes de enviar. Si alguna petición falla, el error trae
 * `guardados` con los ids que sí se guardaron para que la pantalla los refleje.
 */
export async function definirStockMinimo(cambios, inventario) {
    const entradas = Object.entries(cambios);

    if (entradas.length === 0) {
        throw new Error("No hay cambios para guardar.");
    }

    const nuevos = [];

    for (const [id, valor] of entradas) {
        const articulo = inventario.find(
            (a) => String(a.id) === String(id)
        );

        if (!articulo) {
            throw new Error("Uno de los artículos ya no existe.");
        }

        try {
            nuevos.push({
                id,
                nombre: articulo.nombre,
                minimo: validarMinimo(valor),
            });
        } catch (error) {
            throw new Error(`${articulo.nombre}: ${error.message}`, {
                cause: error,
            });
        }
    }

    const resultados = await Promise.allSettled(
        nuevos.map((n) => inventarioApi.actualizarStockMinimo(n.id, n.minimo))
    );

    const guardados = nuevos
        .filter((_, i) => resultados[i].status === "fulfilled")
        .map((n) => n.id);

    const fallos = nuevos
        .map((n, i) => ({ n, r: resultados[i] }))
        .filter(({ r }) => r.status === "rejected");

    if (fallos.length > 0) {
        const { n, r } = fallos[0];
        const error = new Error(
            `No se pudo guardar ${fallos.length} de ${nuevos.length} cambio(s). ` +
            `${n.nombre}: ${r.reason?.message || "error desconocido"}`
        );

        error.guardados = guardados;
        throw error;
    }

    return guardados.length;
}
