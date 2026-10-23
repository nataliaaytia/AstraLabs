const jwt = require("jsonwebtoken");

/**
 * Componente Auth y Roles (ver Modelo C4 - Nivel 3).
 * Valida el token JWT y adjunta el usuario autenticado a la request.
 */
function autenticar(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: payload.usuarioId, rol: payload.rol };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

/**
 * Autorización por rol (RF-26). Úsalo después de `autenticar`.
 * Ejemplo: requiereRol("Administradora")
 */
function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res
        .status(403)
        .json({ error: "No tienes permisos para esta acción" });
    }
    next();
  };
}

module.exports = { autenticar, requiereRol };
