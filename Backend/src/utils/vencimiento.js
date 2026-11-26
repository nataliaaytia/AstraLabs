/**
 * Reglas de fecha de vencimiento al recibir una donación (RF-04).
 *
 * - Vencimiento igual o posterior a la recepción: vigente.
 * - Ya vencido, hasta 21 días antes de la recepción: se acepta, EN OBSERVACIÓN.
 * - Vencido hace más de 21 días: se rechaza.
 */

const DIAS_TOLERANCIA_VENCIMIENTO = 21;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Fecha de hoy en La Paz (YYYY-MM-DD), no la del servidor (que puede estar en UTC). */
function hoyLaPaz() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "YYYY-MM-DD" → milisegundos UTC. Rechaza formatos raros y fechas imposibles (2026-02-31). */
function aMilisegundos(iso, nombre) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (m) {
    const anio = Number(m[1]);
    const mes = Number(m[2]);
    const dia = Number(m[3]);
    const ms = Date.UTC(anio, mes - 1, dia);
    const f = new Date(ms);
    if (
      f.getUTCFullYear() === anio &&
      f.getUTCMonth() === mes - 1 &&
      f.getUTCDate() === dia
    ) {
      return ms;
    }
  }
  throw new Error(`${nombre} debe tener formato YYYY-MM-DD`);
}

/**
 * @param {string} fechaVencimiento  YYYY-MM-DD
 * @param {string} [fechaRecepcion]  YYYY-MM-DD; si no se indica, hoy en La Paz
 * @returns {{estado: "vigente"|"observacion"|"rechazado", diasVencido: number}}
 */
function evaluarVencimiento(fechaVencimiento, fechaRecepcion) {
  const vencimiento = aMilisegundos(fechaVencimiento, "fechaVencimiento");
  const recepcion = aMilisegundos(fechaRecepcion || hoyLaPaz(), "fecha");
  const dias = Math.round((recepcion - vencimiento) / MS_POR_DIA);

  if (dias <= 0) return { estado: "vigente", diasVencido: 0 };
  if (dias <= DIAS_TOLERANCIA_VENCIMIENTO) {
    return { estado: "observacion", diasVencido: dias };
  }
  return { estado: "rechazado", diasVencido: dias };
}

module.exports = { evaluarVencimiento, hoyLaPaz, DIAS_TOLERANCIA_VENCIMIENTO };
