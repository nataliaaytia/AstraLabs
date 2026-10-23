jest.mock("../repositories/usuarioRepository");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

const usuarioRepository = require("../repositories/usuarioRepository");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { login } = require("./authService");

describe("Servicio de Autenticación (RF-25)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "secreto-de-prueba";
  });

  test("inicia sesión con credenciales correctas y devuelve un token", async () => {
    usuarioRepository.obtenerPorEmail.mockResolvedValue({
      id: 1,
      nombre: "Luis",
      email: "luis@amandita.test",
      password_hash: "hash-guardado",
      rol: "Administradora",
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("token-falso");

    const resultado = await login({
      email: "luis@amandita.test",
      password: "clave123",
    });

    expect(resultado.token).toBe("token-falso");
    expect(resultado.usuario).toEqual({
      id: 1,
      nombre: "Luis",
      email: "luis@amandita.test",
      rol: "Administradora",
    });
    expect(resultado.usuario.password_hash).toBeUndefined();
  });

  test("rechaza si el email no existe, con mensaje genérico", async () => {
    usuarioRepository.obtenerPorEmail.mockResolvedValue(null);

    await expect(
      login({ email: "no-existe@amandita.test", password: "clave123" }),
    ).rejects.toThrow("Credenciales inválidas");
  });

  test("rechaza si la contraseña no coincide, con el mismo mensaje genérico", async () => {
    usuarioRepository.obtenerPorEmail.mockResolvedValue({
      id: 1,
      password_hash: "hash-guardado",
      rol: "Administradora",
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      login({ email: "luis@amandita.test", password: "clave-incorrecta" }),
    ).rejects.toThrow("Credenciales inválidas");
  });

  test("rechaza si falta email o password", async () => {
    await expect(login({ email: "", password: "x" })).rejects.toThrow(
      "obligatorios",
    );
  });
});
