const alertaRepository = require("../repositories/alertaRepository");

/**
 * Servicio de Alertas (RF-10): lotes próximos a vencer, con el umbral de días
 * configurable por la Administradora (tabla `configuracion`).
 */

const DIAS_POR_DEFECTO = 7;
const DIAS_MAXIMO = 365;

function validarDias(valor) {
  const n = Number(valor);
  if (
    valor === null ||
    valor === "" ||
    typeof valor === "boolean" ||
    !Number.isInteger(n) ||
    n < 1 ||
    n > DIAS_MAXIMO
  ) {
    throw new Error(`dias debe ser un entero entre 1 y ${DIAS_MAXIMO}`);
  }
  return n;
}

/** Umbral guardado; si falta o está dañado, se usa el valor por defecto (7). */
async function obtenerUmbralVencimiento() {
  const guardado = await alertaRepository.obtenerUmbralVencimiento();
  const n = Number(guardado);
  const dias =
    guardado !== null && Number.isInteger(n) && n >= 1 && n <= DIAS_MAXIMO
      ? n
      : DIAS_POR_DEFECTO;
  return { dias };
}

async function configurarUmbralVencimiento(dias) {
  const n = validarDias(dias);
  await alertaRepository.guardarUmbralVencimiento(n);
  return { dias: n };
}

/**
 * Alertas de vencimiento. Incluye los lotes ya vencidos que aún tienen stock
 * (siguen en el inventario y requieren acción) y los que vencen dentro del
 * umbral. `dias` (opcional) sustituye al umbral configurado solo en esta consulta.
 */
async function obtenerAlertasVencimiento({ dias } = {}) {
  const hayDias = dias !== undefined && dias !== null && dias !== "";
  const umbral = hayDias ? validarDias(dias) : (await obtenerUmbralVencimiento()).dias;

  const filas = await alertaRepository.listarLotesPorVencer(umbral);
  const lotes = filas.map((f) => {
    const diasRestantes = Number(f.dias_restantes);
    return {
      lote_id: f.lote_id,
      numero_lote: f.numero_lote,
      articulo_id: f.articulo_id,
      articulo: f.articulo,
      categoria: f.categoria,
      unidad_medida: f.unidad_medida,
      cantidad_disponible: Number(f.cantidad_disponible),
      fecha_vencimiento: f.fecha_vencimiento,
      dias_restantes: diasRestantes,
      estado: diasRestantes < 0 ? "vencido" : "por_vencer",
    };
  });

  const vencidos = lotes.filter((l) => l.estado === "vencido").length;
  return {
    dias_anticipacion: umbral,
    total: lotes.length,
    vencidos,
    por_vencer: lotes.length - vencidos,
    lotes,
  };
}

/**
 * Alertas de stock mínimo (RF-11): artículos cuyo stock llegó al mínimo o
 * quedó por debajo. estado: "agotado" (0), "bajo_minimo" (< mínimo),
 * "en_minimo" (= mínimo). Los más críticos salen primero.
 */
async function obtenerAlertasStockMinimo() {
  const filas = await alertaRepository.listarArticulosEnMinimo();
  const articulos = filas.map((f) => {
    const actual = Number(f.stock_actual);
    const minimo = Number(f.stock_minimo);
    let estado = "en_minimo";
    if (actual === 0) estado = "agotado";
    else if (actual < minimo) estado = "bajo_minimo";
    return {
      articulo_id: f.articulo_id,
      articulo: f.articulo,
      categoria: f.categoria,
      unidad_medida: f.unidad_medida,
      stock_actual: actual,
      stock_minimo: minimo,
      faltante: Math.max(minimo - actual, 0),
      porcentaje_cubierto: Math.round((actual / minimo) * 100),
      estado,
    };
  });
  const cuenta = (e) => articulos.filter((a) => a.estado === e).length;
  return {
    total: articulos.length,
    agotados: cuenta("agotado"),
    bajo_minimo: cuenta("bajo_minimo"),
    en_minimo: cuenta("en_minimo"),
    articulos,
  };
}

/** Totales de ambas alertas, para el indicador del panel con una sola llamada. */
async function obtenerResumenAlertas() {
  const [venc, stock] = await Promise.all([
    obtenerAlertasVencimiento(),
    obtenerAlertasStockMinimo(),
  ]);
  return {
    total: venc.total + stock.total,
    vencimiento: {
      dias_anticipacion: venc.dias_anticipacion,
      total: venc.total,
      vencidos: venc.vencidos,
      por_vencer: venc.por_vencer,
    },
    stock_minimo: {
      total: stock.total,
      agotados: stock.agotados,
      bajo_minimo: stock.bajo_minimo,
      en_minimo: stock.en_minimo,
    },
  };
}

module.exports = {
  obtenerAlertasStockMinimo,
  obtenerResumenAlertas,
  obtenerAlertasVencimiento,
  obtenerUmbralVencimiento,
  configurarUmbralVencimiento,
};
