const CLAVE_STOCK = "amandita_stock_demo_v1";

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

    return Number(numero.toFixed(3));
}

export function definirStockMinimo(cambios, inventario) {
    const entradas = Object.entries(cambios);

    if (entradas.length === 0) {
        throw new Error("No hay cambios para guardar.");
    }

    const nuevos = new Map();

    for (const [id, valor] of entradas) {
        const articulo = inventario.find(
            (a) => String(a.id) === String(id)
        );

        if (!articulo) {
            throw new Error("Uno de los artículos ya no existe.");
        }

        try {
            nuevos.set(String(id), validarMinimo(valor));
        } catch (error) {
            throw new Error(`${articulo.nombre}: ${error.message}`, {
                cause: error,
            });
        }
    }

    const actualizado = inventario.map((articulo) =>
        nuevos.has(String(articulo.id))
            ? {
                ...articulo,
                stock_minimo: nuevos.get(String(articulo.id)),
            }
            : articulo
    );

    localStorage.setItem(CLAVE_STOCK, JSON.stringify(actualizado));

    return nuevos.size;
}
