function validarFecha(valor, nombre) {
  if (valor === undefined || valor === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(valor))) {
    throw new Error(`${nombre} debe tener formato YYYY-MM-DD`);
  }
  return valor;
}

module.exports = { validarFecha };
