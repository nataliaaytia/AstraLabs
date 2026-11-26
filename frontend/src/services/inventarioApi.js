import { solicitar } from "./api";
import { planificacionApi } from "./planificacionApi";

export const inventarioApi = {
  ...planificacionApi,

  listarLotes() {
    return solicitar("/api/lotes");
  },

  asignarLote(datos) {
    return solicitar("/api/lotes/asignar", {
      method: "POST",
      body: JSON.stringify(datos),
    });
  },

  listarCategorias() {
    return solicitar("/api/categorias");
  },

  listarArticulos() {
    return solicitar("/api/articulos");
  },

  listarNecesidadesCriticas() {
    return solicitar("/api/reportes/necesidades-criticas");
  },

  crearArticulo(datos) {
    return solicitar("/api/articulos", {
      method: "POST",
      body: JSON.stringify(datos),
    });
  },

  actualizarStockMinimo(id, stockMinimo) {
    return solicitar(`/api/articulos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ stockMinimo }),
    });
  },

  // Panel de alertas (sincroniza con el inventario antes de leer).
  // Devuelve { total, pendientes, atendidas, alertas }.
  listarAlertas({ estado, tipo, limite = 500 } = {}) {
    const params = new URLSearchParams({ limite: String(limite) });
    if (estado) params.set("estado", estado);
    if (tipo) params.set("tipo", tipo);
    return solicitar(`/api/alertas?${params}`);
  },

  atenderAlerta(id) {
    return solicitar(`/api/alertas/${id}/atender`, { method: "PATCH" });
  },

  obtenerUmbralVencimiento() {
    return solicitar("/api/alertas/vencimiento/umbral");
  },

  configurarUmbralVencimiento(dias) {
    return solicitar("/api/alertas/vencimiento/umbral", {
      method: "PUT",
      body: JSON.stringify({ dias: Number(dias) }),
    });
  },

  // Historial de movimientos (solo Administradora). Filtros opcionales: desde, hasta, tipo.
  listarMovimientos({ desde, hasta, tipo } = {}) {
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (tipo) params.set("tipo", tipo);
    const consulta = params.toString();
    return solicitar(`/api/movimientos${consulta ? `?${consulta}` : ""}`);
  },

  consultarStock(id) {
    return solicitar(`/api/articulos/${id}/stock`);
  },

  listarDonantes() {
    return solicitar("/api/donantes");
  },

  crearDonante(datos) {
    return solicitar("/api/donantes", {
      method: "POST",
      body: JSON.stringify(datos),
    });
  },

  listarEntradas(limite = 6) {
    return solicitar(`/api/entradas?limite=${limite}`);
  },

  registrarDonacion(datos) {
    return solicitar("/api/entradas", {
      method: "POST",
      body: JSON.stringify(datos),
    });
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
