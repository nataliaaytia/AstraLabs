
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
