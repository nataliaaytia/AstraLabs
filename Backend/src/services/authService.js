const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const usuarioRepository = require("../repositories/usuarioRepository");

const JWT_EXPIRES_IN = "8h";

/**
 * Servicio de Autenticación (RF-25).
 * Nunca distingue en el mensaje de error si falló el email o la
 * contraseña — evita que alguien use el login para adivinar qué
 * correos existen en el sistema.
 */
async function login({ email, password }) {
  if (!email || !password) {
    throw new Error("email y password son obligatorios");
  }

  const usuario = await usuarioRepository.obtenerPorEmail(email);
  if (!usuario) {
    throw new Error("Credenciales inválidas");
  }

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) {
    throw new Error("Credenciales inválidas");
  }

  const token = jwt.sign(
    { usuarioId: usuario.id, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  return {
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    },
  };
}

module.exports = { login };
