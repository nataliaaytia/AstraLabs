import { solicitar } from "./api";
import { planificacionApi } from "./planificacionApi";

export const inventarioApi = {
    ...planificacionApi,

    listarLotes() { return solicitar("/api/lotes"); },
    asignarLote(datos) { return solicitar("/api/lotes/asignar", { method: "POST", body: JSON.stringify(datos) }); },
    listarCategorias() {
        return solicitar("/api/categorias");
    },

    listarArticulos() {
        return solicitar("/api/articulos");
    },

    crearArticulo(datos) {
        return solicitar("/api/articulos", {
            method: "POST",
            body: JSON.stringify(datos),
        });
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

    listarExcedentes() {
        return solicitar("/api/excedentes");
    },

    registrarExcedente(datos) {
        return solicitar("/api/excedentes", {
            method: "POST",
            body: JSON.stringify(datos),
        });
    },
};
