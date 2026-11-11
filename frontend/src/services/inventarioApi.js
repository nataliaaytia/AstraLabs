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

import { cargarDonantes } from "../data/donantes";
import { cargarMenus } from "../data/menus";
import {
    simularFEFO,
    guardarLotes,
} from "../data/lotes";

const CLAVE_STOCK = "amandita_stock_demo_v1";
const CLAVE_CATALOGO = "amandita_catalogo";
const CLAVE_MOVIMIENTOS = "amandita_movimientos_demo_v1";


const CLAVE_PLANES = "amandita_planes_comida_v1";

const PLANES_INICIALES = [
    {
        id: "plan-001",
        nombre: "Arroz con leche",
        fecha: "2026-11-10",
        tipoComida: "Merienda",
        estado: "confirmado",
        ingredientes: [
            { articuloId: "demo-arroz", cantidad: 3 },
            { articuloId: "demo-leche", cantidad: 2 },
        ],
    },
    {
        id: "plan-002",
        nombre: "Almuerzo con arroz",
        fecha: "2026-11-11",
        tipoComida: "Almuerzo",
        estado: "confirmado",
        ingredientes: [
            { articuloId: "demo-arroz", cantidad: 4 },
        ],
    },
    {
        id: "plan-003",
        nombre: "Merienda de leche",
        fecha: "2026-11-12",
        tipoComida: "Merienda",
        estado: "borrador",
        ingredientes: [
            { articuloId: "demo-leche", cantidad: 1 },
        ],
    },
];


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


function obtenerPlanes() {
    const almacenados = leerJSON(CLAVE_PLANES, null);

    if (Array.isArray(almacenados)) {
        return almacenados;
    }

    const iniciales = PLANES_INICIALES.map((plan) => ({
        ...plan,
        ingredientes: plan.ingredientes.map((i) => ({ ...i })),
    }));

    guardarJSON(CLAVE_PLANES, iniciales);
    return iniciales;
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
        throw new Error("Selecciona un motivo válido.");
    }

    if (cantidad > Number(articulo.stock_actual)) {
        throw new Error("Stock insuficiente.");
    }

    const fefo = simularFEFO(
        [{ articuloId: articulo.id, cantidad }],
        inventario
    );

    const nuevoInventario = inventario.map((a) =>
        String(a.id) === String(articulo.id)
            ? {
                ...a,
                stock_actual: Number(
                    (Number(a.stock_actual) - cantidad).toFixed(3)
                ),
            }
            : a
    );

    const movimiento = {
        id: crypto.randomUUID(),
        tipo,
        articuloId: articulo.id,
        articulo: articulo.nombre,
        cantidad,
        usuarioId: datos.usuarioId,
        destino: tipo === "salida" ? datos.destino.trim() : null,
        motivo: tipo === "merma" ? datos.motivo : null,
        lotesConsumidos: fefo.asignaciones,
        fecha: new Date().toISOString(),
    };

    const movimientos = leerJSON(CLAVE_MOVIMIENTOS, []);

    const respaldo = {
        stock: localStorage.getItem(CLAVE_STOCK),
        lotes: localStorage.getItem("amandita_lotes_v1"),
        movimientos: localStorage.getItem(CLAVE_MOVIMIENTOS),
    };

    try {
        guardarJSON(CLAVE_STOCK, nuevoInventario);
        guardarLotes(fefo.lotes);

        guardarJSON(
            CLAVE_MOVIMIENTOS,
            [movimiento, ...movimientos]
        );
    } catch {
        for (const [clave, valor] of [
            [CLAVE_STOCK, respaldo.stock],
            ["amandita_lotes_v1", respaldo.lotes],
            [CLAVE_MOVIMIENTOS, respaldo.movimientos],
        ]) {
            if (valor === null) localStorage.removeItem(clave);
            else localStorage.setItem(clave, valor);
        }

        throw new Error("No se pudo registrar el movimiento.");
    }

    return {
        movimientoId: movimiento.id,
        articuloId: articulo.id,
        cantidadTotal: cantidad,
        stockActual: nuevoInventario.find(
            (a) => String(a.id) === String(articulo.id)
        ).stock_actual,
        lotesConsumidos: fefo.asignaciones,
    };
}

export const inventarioApi = {


    async crearPlanDesdeMenu(datos) {
        const menus = cargarMenus();

        const menu = menus.find(
            (m) => String(m.id) === String(datos.menuId)
        );

        if (!menu) {
            throw new Error("Selecciona un menú registrado.");
        }

        const porciones = Number(datos.porciones);

        if (!Number.isInteger(porciones) || porciones <= 0) {
            throw new Error(
                "La cantidad de porciones debe ser un entero positivo."
            );
        }

        if (!datos.fecha ||
            !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) {
            throw new Error("Selecciona una fecha válida.");
        }

        const inventario = obtenerInventario();

        const ingredientes = menu.ingredientes.map((ingrediente) => {
            const articulo = inventario.find(
                (a) => String(a.id) === String(ingrediente.articuloId)
            );

            if (!articulo) {
                throw new Error(
                    "Uno de los ingredientes ya no está disponible."
                );
            }

            const cantidadTotal = Number(
                (Number(ingrediente.cantidadPorPorcion) * porciones)
                    .toFixed(3)
            );

            if (cantidadTotal <= 0) {
                throw new Error(
                    "La cantidad total de un ingrediente es inválida."
                );
            }

            return {
                articuloId: articulo.id,
                cantidad: cantidadTotal,
            };
        });

        const planes = obtenerPlanes();

        const nuevoPlan = {
            id: crypto.randomUUID(),
            menuId: menu.id,
            nombre: menu.nombre,
            fecha: datos.fecha,
            tipoComida: menu.tipoComida,
            porciones,
            estado: "confirmado",
            ingredientes,
            fechaRegistro: new Date().toISOString(),
        };

        guardarJSON(CLAVE_PLANES, [nuevoPlan, ...planes]);

        return nuevoPlan;
    },


    async listarPlanesComida() {
        return obtenerPlanes();
    },

    async prepararPlanComida(planId, usuarioId) {
        if (!usuarioId) {
            throw new Error("Debes iniciar sesión.");
        }

        const planes = obtenerPlanes();
        const plan = planes.find(
            (p) => String(p.id) === String(planId)
        );

        if (!plan) {
            throw new Error("El plan no existe.");
        }

        if (plan.estado === "preparado") {
            throw new Error("Este plan ya fue preparado.");
        }

        if (plan.estado !== "confirmado") {
            throw new Error(
                "Solo puedes preparar planes confirmados."
            );
        }

        if (!Array.isArray(plan.ingredientes) ||
            plan.ingredientes.length === 0) {
            throw new Error("El plan no tiene ingredientes.");
        }

        const inventario = obtenerInventario();
        const cantidades = new Map();

        for (const ingrediente of plan.ingredientes) {
            const id = String(ingrediente.articuloId);
            const cantidad = Number(ingrediente.cantidad);

            if (!Number.isFinite(cantidad) || cantidad <= 0) {
                throw new Error("El plan tiene cantidades inválidas.");
            }

            cantidades.set(
                id,
                (cantidades.get(id) || 0) + cantidad
            );
        }

        const descuentos = [];

        for (const [id, cantidad] of cantidades) {
            const articulo = inventario.find(
                (a) => String(a.id) === id
            );

            if (!articulo) {
                throw new Error(
                    `No existe el ingrediente con ID ${id}.`
                );
            }

            const disponible = Number(articulo.stock_actual);

            if (cantidad > disponible) {
                throw new Error(
                    `Stock insuficiente de ${articulo.nombre}. ` +
                    `Necesitas ${cantidad} y tienes ${disponible}.`
                );
            }

            descuentos.push({
                articuloId: articulo.id,
                articulo: articulo.nombre,
                cantidad,
                stockAnterior: disponible,
                stockNuevo: Number(
                    (disponible - cantidad).toFixed(3)
                ),
            });
        }


        const fefo = simularFEFO(
            descuentos.map((descuento) => ({
                articuloId: descuento.articuloId,
                cantidad: descuento.cantidad,
            })),
            inventario
        );


        const fechaPreparacion = new Date().toISOString();


        const nuevosPlanes = planes.map((p) =>
            p.id === plan.id
                ? {
                    ...p,
                    estado: "preparado",
                    fechaPreparacion,
                    preparadoPor: usuarioId,
                    lotesConsumidos: fefo.asignaciones,
                }
                : p
        );


        const nuevoInventario = inventario.map((articulo) => {
            const descuento = descuentos.find(
                (d) => String(d.articuloId) === String(articulo.id)
            );

            return descuento
                ? { ...articulo, stock_actual: descuento.stockNuevo }
                : articulo;
        });

        const movimiento = {
            id: crypto.randomUUID(),
            tipo: "preparacion_plan",
            planId: plan.id,
            plan: plan.nombre,
            usuarioId,
            ingredientes: descuentos,
            lotesConsumidos: fefo.asignaciones,
            fecha: fechaPreparacion,
        };

        const movimientos = leerJSON(CLAVE_MOVIMIENTOS, []);


        const respaldo = {
            planes: localStorage.getItem(CLAVE_PLANES),
            stock: localStorage.getItem(CLAVE_STOCK),
            lotes: localStorage.getItem("amandita_lotes_v1"),
            movimientos: localStorage.getItem(CLAVE_MOVIMIENTOS),
        };


        try {
            guardarJSON(CLAVE_STOCK, nuevoInventario);
            guardarLotes(fefo.lotes);
            guardarJSON(CLAVE_PLANES, nuevosPlanes);
            guardarJSON(
                CLAVE_MOVIMIENTOS,
                [movimiento, ...movimientos]
            );
        } catch (error) {
            const restaurar = (clave, valor) => {
                if (valor === null) localStorage.removeItem(clave);
                else localStorage.setItem(clave, valor);
            };

            restaurar(CLAVE_STOCK, respaldo.stock);
            restaurar("amandita_lotes_v1", respaldo.lotes);
            restaurar(CLAVE_PLANES, respaldo.planes);
            restaurar(CLAVE_MOVIMIENTOS, respaldo.movimientos);
            throw new Error("No se pudo guardar la preparación.");
        }


        return {
            exito: true,
            plan: plan.nombre,
            descuentos,
            lotesConsumidos: fefo.asignaciones,
            fechaPreparacion,
        };
    },


    async registrarDonacion(datos) {
        const inventario = obtenerInventario();

        const articulo = inventario.find(
            (a) => String(a.id) === String(datos.articuloId)
        );

        const cantidad = Number(datos.cantidad);

        const donanteRegistrado = cargarDonantes().find(
            (d) => d.id === datos.donanteId
        );

        if (!donanteRegistrado) {
            throw new Error("El donante no está registrado.");
        }

        const donante = donanteRegistrado.nombre;
        const fecha = datos.fecha;


        if (!articulo) {
            throw new Error("Selecciona un artículo válido.");
        }

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new Error("La cantidad debe ser mayor a cero.");
        }

        if (!donante) {
            throw new Error("El nombre del donante es obligatorio.");
        }

        if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            throw new Error("Selecciona una fecha válida.");
        }

        const movimientos = leerJSON(CLAVE_MOVIMIENTOS, []);

        const donacion = {
            id: crypto.randomUUID(),
            tipo: "donacion",
            articuloId: articulo.id,
            articulo: articulo.nombre,
            cantidad,
            donanteId: donanteRegistrado.id,
            donante,
            fecha,
            fechaRegistro: new Date().toISOString(),
            usuarioId: datos.usuarioId,
        };

        articulo.stock_actual = Number(
            (Number(articulo.stock_actual) + cantidad).toFixed(3)
        );

        movimientos.unshift(donacion);

        guardarJSON(CLAVE_STOCK, inventario);
        guardarJSON(CLAVE_MOVIMIENTOS, movimientos);

        return {
            exito: true,
            mensaje: "Donación registrada correctamente.",
            donacion,
            stockActual: articulo.stock_actual,
        };
    },

    async listarDonaciones() {
        const movimientos = leerJSON(CLAVE_MOVIMIENTOS, []);

        return movimientos.filter(
            (movimiento) => movimiento.tipo === "donacion"
        );
    },


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


