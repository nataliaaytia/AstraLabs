const inventarioRepository = require("../repositories/inventarioRepository");
const {
  evaluarVencimiento,
  DIAS_TOLERANCIA_VENCIMIENTO,
} = require("../utils/vencimiento");

/**
 * Servicio de Entradas (RF-02, RF-04): registra donaciones creando el lote y
 * sumando el stock. Los perecederos y las medicinas exigen fecha de
 * vencimiento y número de lote.
 */

const MAXIMO_ITEMS = 50;
const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 100;

function exigeLoteYVencimiento(articulo) {
  return articulo.es_perecedero === true || articulo.categoria === "Medicinas";
}

function mensajeFaltantes(faltaFecha, faltaLote) {
  if (faltaFecha && faltaLote) {
    return "la fecha de vencimiento y el número de lote son obligatorios";
  }
  return faltaFecha
    ? "la fecha de vencimiento es obligatoria"
    : "el número de lote es obligatorio";
}

/**
 * RF-04: valida cada ítem contra su artículo.
 *  - Perecedero o medicina: exige fecha de vencimiento y número de lote.
 *  - Si hay fecha de vencimiento: formato válido; vencido hasta 21 días antes
 *    de la recepción se acepta "en observación"; más allá, se rechaza.
 * Devuelve los ítems con `observaciones` (texto que queda en el movimiento)
 * y la lista de advertencias para quien registra.
 */
async function validarContraArticulos(items, fecha, conPrefijo) {
  const ids = [...new Set(items.map((i) => i.articuloId))];
  const articulos = await inventarioRepository.obtenerArticulosParaEntrada(ids);
  const porId = new Map(articulos.map((a) => [Number(a.id), a]));
  const advertencias = [];

  const validados = items.map((item, indice) => {
    const prefijo = conPrefijo ? `ítem #${indice + 1}: ` : "";
    const articulo = porId.get(item.articuloId);
    if (!articulo) {
      throw new Error(`${prefijo}El artículo no existe`);
    }

    if (exigeLoteYVencimiento(articulo)) {
      const faltaFecha = !item.fechaVencimiento;
      const faltaLote = !item.numeroLote;
      if (faltaFecha || faltaLote) {
        throw new Error(
          `${prefijo}${articulo.nombre} es perecedero o medicina: ${mensajeFaltantes(faltaFecha, faltaLote)}`,
        );
      }
    }

    let observaciones = null;
    if (item.fechaVencimiento) {
      let evaluacion;
      try {
        evaluacion = evaluarVencimiento(item.fechaVencimiento, fecha);
      } catch (err) {
        throw new Error(`${prefijo}${err.message}`);
      }
      if (evaluacion.estado === "rechazado") {
        throw new Error(
          `${prefijo}${articulo.nombre} venció hace ${evaluacion.diasVencido} días; ` +
            `solo se aceptan lotes vencidos hasta ${DIAS_TOLERANCIA_VENCIMIENTO} días antes de la recepción`,
        );
      }
      if (evaluacion.estado === "observacion") {
        observaciones =
          `En observación: lote vencido hace ${evaluacion.diasVencido} día(s) ` +
          `al momento de la recepción (vencía ${item.fechaVencimiento}).`;
        advertencias.push(
          `${prefijo}${articulo.nombre}: vencido hace ${evaluacion.diasVencido} día(s), ` +
            `registrado en observación`,
        );
      }
    }

    return { ...item, observaciones };
  });

  return { items: validados, advertencias };
}

/** Núcleo común: valida (RF-04) y guarda todo en una sola transacción. */
async function procesarEntradas({
  usuarioId,
  donanteId,
  fecha,
  items,
  conPrefijo,
}) {
  const { items: validados, advertencias } = await validarContraArticulos(
    items,
    fecha || null,
    conPrefijo,
  );

  try {
    const entradas = await inventarioRepository.registrarEntradasEnLote({
      usuarioId,
      donanteId: donanteId || null,
      fecha: fecha || null,
      items: validados,
    });
    return { entradas, advertencias };
  } catch (err) {
    if (err.code === "23503") {
      throw new Error("El artículo o el donante no existe");
    }
    if (err.code === "23505") {
      throw new Error("Ya existe un lote con ese número para el artículo");
    }
    throw err;
  }
}

function aIdEntero(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

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
  const articuloIdNumero = aIdEntero(articuloId);
  if (!articuloIdNumero) {
    throw new Error("articuloId debe ser un número entero positivo");
  }

  const { entradas, advertencias } = await procesarEntradas({
    usuarioId,
    donanteId,
    fecha,
    conPrefijo: false,
    items: [
      {
        articuloId: articuloIdNumero,
        cantidad: Number(cantidad),
        fechaVencimiento: fechaVencimiento || null,
        numeroLote: numeroLote || null,
      },
    ],
  });
  return { ...entradas[0], advertencias };
}

/**
 * Donación por lotes: varios artículos en una sola operación (todo o nada).
 * Cada ítem lleva articuloId y cantidad, y opcionalmente numeroLote y
 * fechaVencimiento (obligatorios si el artículo es perecedero o medicina).
 * El donante y la fecha son comunes a toda la donación.
 */
async function registrarEntradasEnLote({ usuarioId, donanteId, fecha, items }) {
  if (!usuarioId) {
    throw new Error("usuarioId es obligatorio");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items debe incluir al menos un artículo");
  }
  if (items.length > MAXIMO_ITEMS) {
    throw new Error(
      `items admite como máximo ${MAXIMO_ITEMS} artículos por donación`,
    );
  }

  const itemsLimpios = items.map((item, indice) => {
    const n = indice + 1;
    if (!item || !item.articuloId) {
      throw new Error(`ítem #${n}: articuloId es obligatorio`);
    }
    const articuloId = aIdEntero(item.articuloId);
    if (!articuloId) {
      throw new Error(
        `ítem #${n}: articuloId debe ser un número entero positivo`,
      );
    }
    if (!Number.isFinite(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
      throw new Error(`ítem #${n}: la cantidad debe ser mayor a cero`);
    }
    return {
      articuloId,
      cantidad: Number(item.cantidad),
      fechaVencimiento: item.fechaVencimiento || null,
      numeroLote: item.numeroLote || null,
    };
  });

  const { entradas, advertencias } = await procesarEntradas({
    usuarioId,
    donanteId,
    fecha,
    items: itemsLimpios,
    conPrefijo: true,
  });

  return {
    donanteId: donanteId || null,
    fecha: fecha || null,
    total: entradas.length,
    advertencias,
    entradas,
  };
}

/**
 * Historial de donaciones (entradas), la más reciente primero.
 * Filtros opcionales: desde, hasta (fecha de recepción), q (artículo o donante),
 * donanteId y limite (por defecto 20, máximo 100).
 */
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

module.exports = { registrarEntrada, listarEntradas, registrarEntradasEnLote };
