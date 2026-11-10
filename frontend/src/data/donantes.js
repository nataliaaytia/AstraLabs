
const CLAVE_DONANTES = "amandita_donantes_v1";

export function cargarDonantes() {
    try {
        const datos = JSON.parse(
            localStorage.getItem(CLAVE_DONANTES) || "[]"
        );

        return Array.isArray(datos) ? datos : [];
    } catch {
        return [];
    }
}

export function registrarDonante(datos) {
    const donantes = cargarDonantes();

    const nombre = datos.nombre.trim().replace(/\s+/g, " ");
    const contacto = datos.contacto.trim();
    const telefono = datos.telefono.trim();
    const correo = datos.correo.trim().toLowerCase();

    if (!nombre || !contacto || (!telefono && !correo)) {
        throw new Error(
            "Ingresa el nombre, persona de contacto y al menos un medio de contacto."
        );
    }

    if (!["persona", "empresa"].includes(datos.tipo)) {
        throw new Error("Selecciona el tipo de donante.");
    }

    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw new Error("El correo electrónico no es válido.");
    }

    const duplicado = donantes.some(
        (donante) =>
            donante.nombre.toLowerCase() === nombre.toLowerCase() &&
            donante.tipo === datos.tipo
    );

    if (duplicado) {
        throw new Error(
            "Ya existe un donante de este tipo con el mismo nombre."
        );
    }

    const nuevoDonante = {
        id: crypto.randomUUID(),
        tipo: datos.tipo,
        nombre,
        contacto,
        telefono,
        correo,
        fechaRegistro: new Date().toISOString(),
    };

    localStorage.setItem(
        CLAVE_DONANTES,
        JSON.stringify([nuevoDonante, ...donantes])
    );

    return nuevoDonante;
}
