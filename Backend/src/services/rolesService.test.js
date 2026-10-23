jest.mock("../repositories/usuarioRepository");

const usuarioRepository = require("../repositories/usuarioRepository");
const rolesService = require("./rolesService");

describe("Servicio de Gestión de Roles (RF-26)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("cambia el rol de otro usuario correctamente", async () => {
    usuarioRepository.actualizarRol.mockResolvedValue({
      id: 2,
      nombre: "Ana",
      email: "ana@x.com",
    });

    const resultado = await rolesService.cambiarRol({
      usuarioIdObjetivo: 2,
      nuevoRol: "Recepcion",
      usuarioIdQueEjecuta: 1,
    });

    expect(resultado.id).toBe(2);
    expect(usuarioRepository.actualizarRol).toHaveBeenCalledWith(
      2,
      "Recepcion",
    );
  });

  test("rechaza un rol que no existe en la lista permitida", async () => {
    await expect(
      rolesService.cambiarRol({
        usuarioIdObjetivo: 2,
        nuevoRol: "SuperAdmin",
        usuarioIdQueEjecuta: 1,
      }),
    ).rejects.toThrow("rol debe ser uno de");

    expect(usuarioRepository.actualizarRol).not.toHaveBeenCalled();
  });

  test("no permite que un usuario se cambie el rol a sí mismo", async () => {
    await expect(
      rolesService.cambiarRol({
        usuarioIdObjetivo: 1,
        nuevoRol: "Recepcion",
        usuarioIdQueEjecuta: 1,
      }),
    ).rejects.toThrow("No puedes modificar tu propio rol");

    expect(usuarioRepository.actualizarRol).not.toHaveBeenCalled();
  });
});
