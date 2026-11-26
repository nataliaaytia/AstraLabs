const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "../../logs");
const ARCHIVO = path.join(DIR, "filtros.log");

/** Arma la entrada de log, o null si la petición no usó filtros. */
function construirEntrada(req, res) {
  if (req.method !== "GET") return null;
  const filtros = Object.fromEntries(
    Object.entries(req.query || {}).map(([k, v]) => [
      k,
      String(v).slice(0, 100),
    ]),
  );
  if (!Object.keys(filtros).length) return null;
  return {
    fecha: new Date().toISOString(),
    usuarioId: req.usuario?.id ?? null,
    rol: req.usuario?.rol ?? null,
    ruta: req.originalUrl.split("?")[0],
    filtros,
    status: res.statusCode,
  };
}

/**
 * Registra qué filtros se usan y quién los usa. Escribe al terminar la
 * respuesta, cuando `autenticar` ya dejó req.usuario. Un fallo al escribir
 * el log nunca debe afectar la petición.
 */
function registrarFiltros(req, res, next) {
  res.on("finish", () => {
    if (process.env.NODE_ENV === "test") return;
    const entrada = construirEntrada(req, res);
    if (!entrada) return;
    fs.mkdir(DIR, { recursive: true }, (err) => {
      if (err) return;
      fs.appendFile(ARCHIVO, JSON.stringify(entrada) + "\n", () => {});
    });
  });
  next();
}

module.exports = { registrarFiltros, construirEntrada };
