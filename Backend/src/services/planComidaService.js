const planComidaRepository = require("../repositories/planComidaRepository");

const TIPOS_COMIDA_VALIDOS = ["desayuno", "merienda", "almuerzo"];

/**
 * Servicio de Plan de Comidas (RF-17): arma un plan por fecha y tipo de
 * comida, con el menú elegido y el número de comensales.
 */
async function registrarPlan({
  fecha,
  tipoComida,
  menuId,
  comensales,
  usuarioId,
}) {
  if (!fecha) {
    throw new Error("fecha es obligatoria");
  }
  if (!TIPOS_COMIDA_VALIDOS.includes(tipoComida)) {
    throw new Error(
      `tipoComida debe ser uno de: ${TIPOS_COMIDA_VALIDOS.join(", ")}`,
    );
  }
  if (!menuId) {
    throw new Error("menuId es obligatorio");
  }
  const comensalesNumero = Number(comensales);
  if (!Number.isInteger(comensalesNumero) || comensalesNumero <= 0) {
    throw new Error("comensales debe ser un número entero mayor a cero");
  }
  if (!usuarioId) {
    throw new Error("usuarioId es obligatorio");
  }

  try {
    return await planComidaRepository.crearPlan({
      fecha,
      tipoComida,
      menuId,
      comensales: comensalesNumero,
      usuarioId,
    });
  } catch (err) {
    if (err.code === "23505") {
      throw new Error(
        "Ya existe un plan registrado para esa fecha y tipo de comida",
      );
    }
    if (err.code === "23503") {
      throw new Error("El menú seleccionado no existe");
    }
    throw err;
  }
}

async function listarPlanes(filtros = {}) {
  return planComidaRepository.listarPlanes(filtros);
}

async function confirmarPlan({ planId, usuarioId }) {
  if (!planId) {
    throw new Error("planId es obligatorio");
  }
  if (!usuarioId) {
    throw new Error("usuarioId es obligatorio");
  }

  return planComidaRepository.confirmarPlanConDescuento({ planId, usuarioId });
}

const ORDEN_ESTADO = { sin_stock: 0, insuficiente: 1, suficiente: 2 };

async function obtenerFaltantesPlan(planId) {
  const id = Number(planId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("planId debe ser un número entero positivo");
  }

  const plan = await planComidaRepository.obtenerPlan(id);
  if (!plan) {
    throw new Error("El plan de comidas no existe");
  }
  if (plan.estado !== "planificado") {
    throw new Error(`El plan ya fue ${plan.estado}`);
  }

  const filas = await planComidaRepository.calcularIngredientesPlan(id);
  const ingredientes = filas
    .map((f) => {
      const requerida = Number(f.requerida);
      const disponible = Number(f.disponible);
      const faltante = Number(f.faltante);
      let estado = "suficiente";
      if (faltante > 0) estado = disponible === 0 ? "sin_stock" : "insuficiente";
      return {
        articulo_id: f.articulo_id,
        articulo: f.articulo,
        categoria: f.categoria,
        unidad_medida: f.unidad_medida,
        cantidad_por_porcion: Number(f.cantidad_por_porcion),
        requerida,
        disponible,
        faltante,
        estado,
      };
    })
    .sort(
      (a, b) =>
        ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] ||
        a.articulo.localeCompare(b.articulo),
    );

  const conFaltantes = ingredientes.filter((i) => i.estado !== "suficiente").length;
  const respuesta = {
    plan: {
      id: plan.id,
      fecha: plan.fecha,
      tipo_comida: plan.tipo_comida,
      comensales: plan.comensales,
      estado: plan.estado,
      menu_id: plan.menu_id,
      menu: plan.menu,
    },
    total_ingredientes: ingredientes.length,
    con_faltantes: conFaltantes,
    puede_prepararse: ingredientes.length > 0 && conFaltantes === 0,
    ingredientes,
  };
  if (ingredientes.length === 0) {
    respuesta.advertencia = "El menú de este plan no tiene ingredientes registrados";
  }
  return respuesta;
}

module.exports = {
  registrarPlan,
  listarPlanes,
  confirmarPlan,
  obtenerFaltantesPlan,
};
