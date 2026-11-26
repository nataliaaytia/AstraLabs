import { solicitar, obtenerUsuarioGuardado } from "./api";

function usuarioId() {
    const id = obtenerUsuarioGuardado()?.id;
    if (!id) throw new Error("Debes iniciar sesión para registrar planes de comida.");
    return id;
}

function normalizarPlan(p) {
    return {
        id: p.id,
        fecha: String(p.fecha).slice(0, 10),
        tipoComida: p.tipo_comida?.charAt(0).toUpperCase() + p.tipo_comida?.slice(1),
        nombre: p.menu,
        menuId: p.menu_id,
        porciones: Number(p.comensales),
        // El backend solo tiene planificado y confirmado; confirmar ya descuenta stock.
        estado: p.estado === "planificado" ? "borrador" : p.estado === "confirmado" ? "preparado" : p.estado,
        ingredientes: (p.ingredientes || []).map(i => ({
            articuloId: i.articuloId,
            cantidad: Number(i.cantidadPorPorcion) * Number(p.comensales),
        })),
    };
}

export const planificacionApi = {
    async listarPlanesComida() {
        const planes = await solicitar("/api/planes-comida");
        return planes.map(normalizarPlan);
    },
    async crearPlanDesdeMenu({ fecha, menuId, porciones, tipoComida = "Almuerzo" }) {
        return solicitar("/api/planes-comida", {
            method: "POST",
            body: JSON.stringify({ fecha, tipoComida: tipoComida.toLowerCase(),
                menuId: Number(menuId), comensales: Number(porciones), usuarioId: usuarioId() }),
        });
    },
    async guardarPlanificacion(registros) {
        if (!registros.length) throw new Error("Selecciona al menos una comida.");
        // No es una transacción global: reportar exactamente lo creado ante un error.
        const creados = [];
        for (const r of registros) {
            try {
                creados.push(await this.crearPlanDesdeMenu({
                    ...r, porciones: r.comensales,
                }));
            } catch (error) {
                throw new Error(`${error.message}. Se guardaron ${creados.length} de ${registros.length} comidas; revisa los planes antes de reintentar.`);
            }
        }
        return creados;
    },
    async confirmarPlanComida(planId) {
        return solicitar(`/api/planes-comida/${planId}/confirmar`, {
            method: "POST", body: JSON.stringify({ usuarioId: usuarioId() }),
        });
    },
};
