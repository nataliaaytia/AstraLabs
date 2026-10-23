const usuarioRepository = require("../repositories/usuarioRepository");

const ROLES_VALIDOS = ["Administradora", "Recepcion", "Almacen_Cocina"];

/**
 * Servicio de Gestión de Roles (RF-26).
 */
async function listar() {
  return usuarioRepository.listarUsuarios();
}

async function cambiarRol({
  usuarioIdObjetivo,
  nuevoRol,
  usuarioIdQueEjecuta,
}) {
  if (!ROLES_VALIDOS.includes(nuevoRol)) {
    throw new Error(`rol debe ser uno de: ${ROLES_VALIDOS.join(", ")} (RF-26)`);
  }
  if (Number(usuarioIdObjetivo) === Number(usuarioIdQueEjecuta)) {
    throw new Error("No puedes modificar tu propio rol");
  }

  return usuarioRepository.actualizarRol(usuarioIdObjetivo, nuevoRol);
}

module.exports = { listar, cambiarRol };
