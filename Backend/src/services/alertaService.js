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

module.exports = {
  obtenerAlertasVencimiento,
  obtenerUmbralVencimiento,
  configurarUmbralVencimiento,
};
