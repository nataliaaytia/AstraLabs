
const CLAVE_LOTES = "amandita_lotes_v1";

function redondear(valor) {
    return Number(Number(valor).toFixed(3));
}

function leerLotes() {
    try {
        const datos = JSON.parse(
            localStorage.getItem(CLAVE_LOTES) || "[]"
        );

        return Array.isArray(datos) ? datos : [];
    } catch {
        return [];
    }
}

export function guardarLotes(lotes) {
    localStorage.setItem(CLAVE_LOTES, JSON.stringify(lotes));
}

function hoyLocal() {
    const fecha = new Date();
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

function ordenarFEFO(a, b) {
    if (!a.fechaVencimiento && !b.fechaVencimiento) return 0;
    if (!a.fechaVencimiento) return 1;
    if (!b.fechaVencimiento) return -1;

    return a.fechaVencimiento.localeCompare(b.fechaVencimiento);
}

export function obtenerLotes(inventario) {
    const lotes = leerLotes().map((lote) => ({ ...lote }));
    let cambiado = false;

    for (const articulo of inventario) {
        const propios = lotes.filter(
            (l) => String(l.articuloId) === String(articulo.id)
        );

        const stockActual = redondear(articulo.stock_actual);

        const total = redondear(
            propios.reduce(
                (suma, lote) => suma + Number(lote.cantidadDisponible),
                0
            )
        );

        if (propios.length === 0 && stockActual > 0) {
            lotes.push({
                id: crypto.randomUUID(),
                articuloId: articulo.id,
                codigo: "SIN-ASIGNAR",
                fechaVencimiento: null,
                cantidadDisponible: stockActual,
            });

            cambiado = true;
        } else if (stockActual > total) {
            const diferencia = redondear(stockActual - total);

            const sinAsignar = propios.find(
                (l) => l.codigo === "SIN-ASIGNAR" &&
                    !l.fechaVencimiento
            );

            if (sinAsignar) {
                sinAsignar.cantidadDisponible = redondear(
                    Number(sinAsignar.cantidadDisponible) + diferencia
                );
            } else {
                lotes.push({
                    id: crypto.randomUUID(),
                    articuloId: articulo.id,
                    codigo: "SIN-ASIGNAR",
                    fechaVencimiento: null,
                    cantidadDisponible: diferencia,
                });
            }

            cambiado = true;
        } else if (stockActual < total) {
            let diferencia = redondear(total - stockActual);

            const ordenados = [...propios].sort(ordenarFEFO);

            for (const lote of ordenados) {
                if (diferencia <= 0) break;

                const descuento = Math.min(
                    Number(lote.cantidadDisponible),
                    diferencia
                );

                lote.cantidadDisponible = redondear(
                    Number(lote.cantidadDisponible) - descuento
                );

                diferencia = redondear(diferencia - descuento);
            }

            cambiado = true;
        }
    }

    if (cambiado) guardarLotes(lotes);

    return lotes;
}

export function asignarLote(datos, inventario) {
    const cantidad = Number(datos.cantidad);
    const codigo = datos.codigo?.trim().toUpperCase();
    const fecha = datos.fechaVencimiento;

    if (!codigo) {
        throw new Error("Ingresa un código de lote.");
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new Error("La cantidad debe ser mayor a cero.");
    }

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        Number.isNaN(new Date(`${fecha}T12:00:00`).getTime())) {
        throw new Error("Selecciona una fecha válida.");
    }

    if (fecha < hoyLocal()) {
        throw new Error("No puedes asignar un vencimiento pasado.");
    }

    const articulo = inventario.find(
        (a) => String(a.id) === String(datos.articuloId)
    );

    if (!articulo) {
        throw new Error("Selecciona un artículo válido.");
    }

    const lotes = obtenerLotes(inventario);

    const duplicado = lotes.some(
        (l) =>
            String(l.articuloId) === String(articulo.id) &&
            l.codigo === codigo
    );

    if (duplicado) {
        throw new Error("Ya existe ese código de lote para el artículo.");
    }

    const sinAsignar = lotes.find(
        (l) =>
            String(l.articuloId) === String(articulo.id) &&
            l.codigo === "SIN-ASIGNAR" &&
            !l.fechaVencimiento
    );

    if (!sinAsignar ||
        cantidad > Number(sinAsignar.cantidadDisponible)) {
        throw new Error(
            "No hay suficiente stock sin asignar para crear el lote."
        );
    }

    sinAsignar.cantidadDisponible = redondear(
        Number(sinAsignar.cantidadDisponible) - cantidad
    );

    const nuevo = {
        id: crypto.randomUUID(),
        articuloId: articulo.id,
        codigo,
        fechaVencimiento: fecha,
        cantidadDisponible: redondear(cantidad),
    };

    lotes.push(nuevo);
    guardarLotes(lotes);

    return nuevo;
}

export function simularFEFO(consumos, inventario) {
    const lotes = obtenerLotes(inventario).map((l) => ({ ...l }));
    const asignaciones = [];
    const hoy = hoyLocal();

    for (const consumo of consumos) {
        let pendiente = redondear(consumo.cantidad);

        if (!Number.isFinite(pendiente) || pendiente <= 0) {
            throw new Error("Cantidad de consumo inválida.");
        }

        const articulo = inventario.find(
            (a) => String(a.id) === String(consumo.articuloId)
        );

        if (!articulo) {
            throw new Error("Ingrediente no encontrado.");
        }

        const disponibles = lotes
            .filter(
                (l) =>
                    String(l.articuloId) === String(articulo.id) &&
                    Number(l.cantidadDisponible) > 0 &&
                    (!l.fechaVencimiento ||
                        l.fechaVencimiento >= hoy)
            )
            .sort(ordenarFEFO);

        const totalUtilizable = redondear(
            disponibles.reduce(
                (suma, l) => suma + Number(l.cantidadDisponible),
                0
            )
        );

        if (pendiente > totalUtilizable) {
            throw new Error(
                `No hay stock utilizable suficiente de ${articulo.nombre}. ` +
                `Disponible: ${totalUtilizable}.`
            );
        }

        for (const lote of disponibles) {
            if (pendiente <= 0) break;

            const cantidad = Math.min(
                pendiente,
                Number(lote.cantidadDisponible)
            );

            lote.cantidadDisponible = redondear(
                Number(lote.cantidadDisponible) - cantidad
            );

            pendiente = redondear(pendiente - cantidad);

            asignaciones.push({
                articuloId: articulo.id,
                articulo: articulo.nombre,
                loteId: lote.id,
                codigoLote: lote.codigo,
                fechaVencimiento: lote.fechaVencimiento,
                cantidad: redondear(cantidad),
                unidad: articulo.unidad_medida,
            });
        }
    }

    return { lotes, asignaciones };
}
