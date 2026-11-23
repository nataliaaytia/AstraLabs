const inventarioRepository = require("../repositories/inventarioRepository");

/**
 * Servicio de Entradas (RF-02): registra la entrada de una donación,
 * creando un lote nuevo y actualizando el stock.
 */
async function registrarEntrada({
  articuloId,
  cantidad,
  usuarioId,
  donanteId,
  fecha,
  fechaVencimiento,
  numeroLote,
}) {
  if (!articuloId) {
    throw new Error("articuloId es obligatorio");
  }
  if (!usuarioId) {
    throw new Error("usuarioId es obligatorio");
  }
  if (!Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0) {
    throw new Error("La cantidad debe ser mayor a cero");
  }

  return inventarioRepository.registrarEntrada({
    articuloId,
    cantidad: Number(cantidad),
    usuarioId,
    donanteId: donanteId || null,
    fecha: fecha || null,
    fechaVencimiento: fechaVencimiento || null,
    numeroLote: numeroLote || null,
  });
}

const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 100;

async function listarEntradas({ desde, hasta, q, donanteId, limite } = {}) {
  let limiteNumero = LIMITE_POR_DEFECTO;
  if (limite !== undefined && limite !== null && limite !== "") {
    limiteNumero = Number(limite);
    if (
      !Number.isInteger(limiteNumero) ||
      limiteNumero <= 0 ||
      limiteNumero > LIMITE_MAXIMO
    ) {
      throw new Error(`limite debe ser un entero entre 1 y ${LIMITE_MAXIMO}`);
    }
  }

  let donanteIdNumero;
  if (donanteId !== undefined && donanteId !== null && donanteId !== "") {
    donanteIdNumero = Number(donanteId);
    if (!Number.isInteger(donanteIdNumero) || donanteIdNumero <= 0) {
      throw new Error("donanteId debe ser un número entero positivo");
    }
  }

  const entradas = await inventarioRepository.listarEntradas({
    desde,
    hasta,
    q,
    donanteId: donanteIdNumero,
    limite: limiteNumero,
  });
  return entradas.map((e) => ({ ...e, cantidad: Number(e.cantidad) }));
}

const MAXIMO_ITEMS = 50;

async function registrarEntradasEnLote({ usuarioId, donanteId, fecha, items }) {
  if (!usuarioId) {
    throw new Error("usuarioId es obligatorio");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items debe incluir al menos un artículo");
  }
  if (items.length > MAXIMO_ITEMS) {
    throw new Error(`items admite como máximo ${MAXIMO_ITEMS} artículos por donación`);
  }

  const itemsLimpios = items.map((item, indice) => {
    const n = indice + 1;
    if (!item || !item.articuloId) {
      throw new Error(`ítem #${n}: articuloId es obligatorio`);
    }
    if (!Number.isFinite(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
      throw new Error(`ítem #${n}: la cantidad debe ser mayor a cero`);
    }
    return {
      articuloId: item.articuloId,
      cantidad: Number(item.cantidad),
      fechaVencimiento: item.fechaVencimiento || null,
      numeroLote: item.numeroLote || null,
    };
  });

  try {
    const entradas = await inventarioRepository.registrarEntradasEnLote({
      usuarioId,
      donanteId: donanteId || null,
      fecha: fecha || null,
      items: itemsLimpios,
    });
    return { donanteId: donanteId || null, fecha: fecha || null, total: entradas.length, entradas };
  } catch (err) {
    if (err.code === "23503") throw new Error("Uno de los artículos o el donante no existe");
    if (err.code === "23505") throw new Error("Ya existe un lote con ese número para el artículo");
    throw err;
  }
}

module.exports = { registrarEntrada, listarEntradas, registrarEntradasEnLote };
