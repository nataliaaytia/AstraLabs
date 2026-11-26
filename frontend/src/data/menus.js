import { solicitar } from "../services/api";

export async function cargarMenus() {
    const menus = await solicitar("/api/menus");
    return menus.map(menu => ({
        ...menu,
        ingredientes: (menu.ingredientes || []).map(i => ({
            articuloId: i.articuloId,
            cantidadPorPorcion: Number(i.cantidadPorPorcion),
        })),
    }));
}

export async function registrarMenu(datos, articulos) {
    const nombre = datos.nombre?.trim().replace(/\s+/g, " ");
    if (!nombre) throw new Error("Ingresa el nombre del menú.");
    const ingredientes = (datos.ingredientes || []).map(i => {
        const articulo = articulos.find(a => String(a.id) === String(i.articuloId));
        const cantidad = Number(i.cantidadPorPorcion);
        if (!articulo) throw new Error("Selecciona artículos válidos.");
        if (!Number.isFinite(cantidad) || cantidad <= 0) throw new Error("La cantidad debe ser mayor que cero.");
        return { articuloId: articulo.id, cantidadPorPorcion: cantidad };
    });
    if (!ingredientes.length || new Set(ingredientes.map(i => String(i.articuloId))).size !== ingredientes.length) {
        throw new Error("Agrega ingredientes sin repetir.");
    }
    return solicitar("/api/menus", { method: "POST", body: JSON.stringify({
        nombre, descripcion: datos.descripcion, ingredientes,
    }) });
}
