
const CLAVE_MENUS = "amandita_menus_v1";

export function cargarMenus() {
    try {
        const datos = JSON.parse(
            localStorage.getItem(CLAVE_MENUS) || "[]"
        );

        return Array.isArray(datos) ? datos : [];
    } catch {
        return [];
    }
}

export function registrarMenu(datos, articulos) {
    const nombre = datos.nombre?.trim().replace(/\s+/g, " ");
    const descripcion = datos.descripcion?.trim() || "";

    if (!nombre) {
        throw new Error("Ingresa el nombre del menú.");
    }

    if (!["Desayuno", "Almuerzo", "Merienda", "Cena"].includes(
        datos.tipoComida
    )) {
        throw new Error("Selecciona un tipo de comida válido.");
    }

    if (!Array.isArray(datos.ingredientes) ||
        datos.ingredientes.length === 0) {
        throw new Error("Agrega al menos un ingrediente.");
    }

    const ingredientes = datos.ingredientes.map((ingrediente) => {
        const articulo = articulos.find(
            (a) => String(a.id) === String(ingrediente.articuloId)
        );

        const cantidad = Number(ingrediente.cantidadPorPorcion);

        if (!articulo) {
            throw new Error("Selecciona artículos válidos.");
        }

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new Error(
                "Cada ingrediente debe tener una cantidad mayor a cero."
            );
        }

        return {
            articuloId: articulo.id,
            cantidadPorPorcion: cantidad,
        };
    });

    const ids = ingredientes.map((i) => String(i.articuloId));

    if (new Set(ids).size !== ids.length) {
        throw new Error(
            "No puedes repetir un ingrediente en el mismo menú."
        );
    }

    const menus = cargarMenus();

    if (menus.some(
        (menu) => menu.nombre.toLowerCase() === nombre.toLowerCase()
    )) {
        throw new Error("Ya existe un menú con ese nombre.");
    }

    const nuevoMenu = {
        id: crypto.randomUUID(),
        nombre,
        descripcion,
        tipoComida: datos.tipoComida,
        ingredientes,
        fechaRegistro: new Date().toISOString(),
    };

    localStorage.setItem(
        CLAVE_MENUS,
        JSON.stringify([nuevoMenu, ...menus])
    );

    return nuevoMenu;
}
