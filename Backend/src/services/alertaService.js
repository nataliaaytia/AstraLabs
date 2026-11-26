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
  const umbral = hayDias
    ? validarDias(dias)
    : (await obtenerUmbralVencimiento()).dias;

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

// ---------- Panel de alertas (RF-12) ----------

const ESTADOS = ["pendiente", "atendida"];
const TIPOS = ["vencimiento", "stock_minimo"];
const LIMITE_POR_DEFECTO = 100;
const LIMITE_MAXIMO = 500;

async function sincronizarAlertas({ articuloIds } = {}) {
  const { dias } = await obtenerUmbralVencimiento();
  return alertaRepository.sincronizarAlertas({
    diasVencimiento: dias,
    articuloIds: articuloIds && articuloIds.length ? articuloIds : null,
  });
}

function plural(n, palabra) {
  return `${n} ${palabra}${n === 1 ? "" : "s"}`;
}

function mensajeAlerta(f) {
  if (f.tipo === "vencimiento") {
    const d = Number(f.dias_restantes);
    const lote = f.numero_lote ? `lote ${f.numero_lote}` : "lote sin número";
    const cuando =
      d < 0
        ? `venció hace ${plural(-d, "día")}`
        : d === 0
          ? "vence hoy"
          : `vence en ${plural(d, "día")}`;
    return `${f.articulo}: ${lote} ${cuando} (${f.fecha_vencimiento}); ${Number(f.cantidad_lote)} ${f.unidad_medida} disponibles`;
  }
  return `${f.articulo}: stock ${Number(f.stock_actual)} ${f.unidad_medida}, mínimo ${Number(f.stock_minimo)} ${f.unidad_medida}`;
}

/**
 * Panel de alertas: lista las alertas con su estado (pendiente / atendida),
 * las pendientes primero. Por defecto sincroniza antes de leer, para que
 * refleje la situación actual del inventario.
 * Filtros: estado, tipo, q (nombre del artículo), limite (100 por defecto, máx. 500).
 */
async function listarAlertas({
  estado,
  tipo,
  q,
  limite,
  sincronizar = true,
} = {}) {
  if (estado && !ESTADOS.includes(estado)) {
    throw new Error(`estado debe ser uno de: ${ESTADOS.join(", ")}`);
  }
  if (tipo && !TIPOS.includes(tipo)) {
    throw new Error(`tipo debe ser uno de: ${TIPOS.join(", ")}`);
  }
  let limiteNumero = LIMITE_POR_DEFECTO;
  if (limite !== undefined && limite !== null && limite !== "") {
    limiteNumero = Number(limite);
    if (
      !Number.isInteger(limiteNumero) ||
      limiteNumero < 1 ||
      limiteNumero > LIMITE_MAXIMO
    ) {
      throw new Error(`limite debe ser un entero entre 1 y ${LIMITE_MAXIMO}`);
    }
  }

  if (sincronizar) await sincronizarAlertas();

  const filtros = { tipo: tipo || undefined, q: q || undefined };
  const [filas, conteo] = await Promise.all([
    alertaRepository.listarAlertas({
      ...filtros,
      estado: estado || undefined,
      limite: limiteNumero,
    }),
    alertaRepository.contarAlertas(filtros),
  ]);

  const pendientes = conteo.pendiente || 0;
  const atendidas = conteo.atendida || 0;
  return {
    total: pendientes + atendidas,
    pendientes,
    atendidas,
    alertas: filas.map((f) => ({
      id: f.id,
      tipo: f.tipo,
      estado: f.estado,
      mensaje: mensajeAlerta(f),
      fecha_generada: f.fecha_generada,
      fecha_atendida: f.fecha_atendida,
      atendida_por: f.atendida_por, // null = cerrada automáticamente al resolverse la situación
      articulo_id: f.articulo_id,
      articulo: f.articulo,
      categoria: f.categoria,
      unidad_medida: f.unidad_medida,
      stock_actual: Number(f.stock_actual),
      stock_minimo: Number(f.stock_minimo),
      lote_id: f.lote_id,
      numero_lote: f.numero_lote,
      fecha_vencimiento: f.fecha_vencimiento,
      dias_restantes:
        f.dias_restantes === null ? null : Number(f.dias_restantes),
    })),
  };
}

async function atenderAlerta(id, usuarioId) {
  const alertaId = Number(id);
  if (!Number.isInteger(alertaId) || alertaId <= 0) {
    throw new Error("id debe ser un número entero positivo");
  }
  if (!usuarioId) {
    throw new Error("usuarioId es obligatorio");
  }
  const atendida = await alertaRepository.atenderAlerta(alertaId, usuarioId);
  if (!atendida) {
    if (!(await alertaRepository.existeAlerta(alertaId))) {
      throw new Error("La alerta no existe");
    }
    throw new Error("La alerta ya fue atendida");
  }
  return { id: alertaId, estado: "atendida" };
}

module.exports = {
  sincronizarAlertas,
  listarAlertas,
  atenderAlerta,
  obtenerAlertasStockMinimo,
  obtenerResumenAlertas,
  obtenerAlertasVencimiento,
  obtenerUmbralVencimiento,
  configurarUmbralVencimiento,
};
