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

async function listarPlanes({ fecha } = {}) {
  return planComidaRepository.listarPlanes({ fecha });
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

module.exports = { registrarPlan, listarPlanes, confirmarPlan };
