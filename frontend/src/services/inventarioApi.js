/*
const API_URL = (
    import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

async function solicitar(ruta, opciones = {}) {
    let respuesta;

    try {
        respuesta = await fetch(`${API_URL}${ruta}`, {
            ...opciones,
            headers: {
                "Content-Type": "application/json",
                ...opciones.headers,
            },
        });
    } catch {
        throw new Error(
            "No hay conexión con el servidor. Verifica que el backend esté encendido."
        );
    }

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
        throw new Error(
            datos.error || `Error del servidor (${respuesta.status})`
        );
    }

    return datos;
}

export const inventarioApi = {
    listarArticulos() {
        return solicitar("/api/articulos");
    },

    consultarStock(id) {
        return solicitar(`/api/articulos/${id}/stock`);
    },

    registrarSalida(datos) {
        return solicitar("/api/salidas", {
            method: "POST",
            body: JSON.stringify(datos),
        });
    },

    registrarMerma(datos) {
        return solicitar("/api/mermas", {
            method: "POST",
            body: JSON.stringify(datos),
        });
    },
};
*/


const CLAVE_STOCK = "amandita_stock_demo_v1";
const CLAVE_CATALOGO = "amandita_catalogo_demo";
const CLAVE_MOVIMIENTOS = "amandita_movimientos_demo_v1";

const ARTICULOS_INICIALES = [
    {
        id: "demo-arroz",
        nombre: "Arroz",
        categoria: "Alimentos",
        unidad_medida: "Kilogramo",
        stock_minimo: 20,
        stock_actual: 80,
    },
    {
        id: "demo-leche",
        nombre: "Leche en polvo",
        categoria: "Alimentos",
        unidad_medida: "Kilogramo",
        stock_minimo: 10,
        stock_actual: 25,
    },
    {
        id: "demo-paracetamol",
        nombre: "Paracetamol",
        categoria: "Medicamentos",
        unidad_medida: "Caja",
        stock_minimo: 5,
        stock_actual: 15,
    },
];

function leerJSON(clave, valorDefecto) {
    try {
        const datos = localStorage.getItem(clave);
        return datos ? JSON.parse(datos) : valorDefecto;
    } catch {
        return valorDefecto;
    }
}

function guardarJSON(clave, datos) {
    localStorage.setItem(clave, JSON.stringify(datos));
}

function obtenerInventario() {
    const almacenados = leerJSON(CLAVE_STOCK, null);

    const stock = Array.isArray(almacenados)
        ? almacenados
        : ARTICULOS_INICIALES.map((a) => ({ ...a }));

    // Incorporar artículos registrados en la HU-01.
    const catalogo = leerJSON(CLAVE_CATALOGO, []);

    if (Array.isArray(catalogo)) {
        catalogo.forEach((articulo) => {
            if (!stock.some((a) => String(a.id) === String(articulo.id))) {
                stock.push({
                    id: articulo.id,
                    nombre: articulo.nombre,
                    categoria: articulo.categoria,
                    unidad_medida: articulo.unidadMedida,
                    stock_minimo: 0,
                    stock_actual: 0,
                });
            }
        });
    }

    guardarJSON(CLAVE_STOCK, stock);
    return stock;
}

function registrarMovimiento(tipo, datos) {
    const inventario = obtenerInventario();
    const articulo = inventario.find(
        (a) => String(a.id) === String(datos.articuloId)
    );

    const cantidad = Number(datos.cantidad);

    if (!articulo) {
        throw new Error("El artículo no existe.");
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new Error("La cantidad debe ser mayor a cero.");
    }

    if (!datos.usuarioId) {
        throw new Error("Debes iniciar sesión.");
    }

    if (tipo === "salida" && !datos.destino?.trim()) {
        throw new Error("Debes indicar un destino.");
    }

    if (
        tipo === "merma" &&
        !["vencimiento", "deterioro", "perdida"].includes(datos.motivo)
    ) {
        throw new Error("Debes seleccionar un motivo válido.");
    }

    if (cantidad > Number(articulo.stock_actual)) {
        throw new Error(
            `Stock insuficiente. Disponible: ${articulo.stock_actual}.`
        );
    }

    articulo.stock_actual = Number(
        (Number(articulo.stock_actual) - cantidad).toFixed(3)
    );

    const movimientos = leerJSON(CLAVE_MOVIMIENTOS, []);

    const movimiento = {
        id: crypto.randomUUID(),
        tipo,
        articuloId: articulo.id,
        articulo: articulo.nombre,
        cantidad,
        usuarioId: datos.usuarioId,
        destino: tipo === "salida" ? datos.destino.trim() : null,
        motivo: tipo === "merma" ? datos.motivo : null,
        fecha: new Date().toISOString(),
    };

    movimientos.unshift(movimiento);

    guardarJSON(CLAVE_STOCK, inventario);
    guardarJSON(CLAVE_MOVIMIENTOS, movimientos);

    return {
        movimientoId: movimiento.id,
        articuloId: articulo.id,
        cantidadTotal: cantidad,
        stockActual: articulo.stock_actual,
    };
}

export const inventarioApi = {
    async listarArticulos() {
        return obtenerInventario();
    },

    async consultarStock(id) {
        const articulo = obtenerInventario().find(
            (a) => String(a.id) === String(id)
        );

        if (!articulo) {
            throw new Error("Artículo no encontrado.");
        }

        return {
            articulo_id: articulo.id,
            articulo: articulo.nombre,
            stock_actual: articulo.stock_actual,
            stock_minimo: articulo.stock_minimo,
        };
    },

    async registrarSalida(datos) {
        return registrarMovimiento("salida", datos);
    },

    async registrarMerma(datos) {
        return registrarMovimiento("merma", datos);
    },

    async listarMovimientos() {
        return leerJSON(CLAVE_MOVIMIENTOS, []);
    },

    async registrarStockInicial(id, cantidad) {
        const inventario = obtenerInventario();
        const articulo = inventario.find(
            (a) => String(a.id) === String(id)
        );

        if (!articulo) {
            throw new Error("Artículo no encontrado.");
        }

        const numero = Number(cantidad);

        if (!Number.isFinite(numero) || numero < 0) {
            throw new Error("Ingresa una cantidad válida.");
        }

        articulo.stock_actual = numero;
        guardarJSON(CLAVE_STOCK, inventario);

        return articulo;
    },
};
