jest.mock("../repositories/donanteRepository");

const donanteRepository = require("../repositories/donanteRepository");
const donanteService = require("./donanteService");

describe("Servicio de Donantes (RF-14)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("registra un donante válido", async () => {
    donanteRepository.crearDonante.mockResolvedValue({
      id: 1,
      nombre: "Juana Pérez",
      tipo: "persona",
    });

    const resultado = await donanteService.registrarDonante({
      nombre: "Juana Pérez",
      tipo: "persona",
      contacto: "Juana",
      telefono: "70000000",
      email: "juana@test.com",
    });

    expect(resultado.id).toBe(1);
    expect(donanteRepository.crearDonante).toHaveBeenCalledWith({
      nombre: "Juana Pérez",
      tipo: "persona",
      contacto: "Juana",
      telefono: "70000000",
      email: "juana@test.com",
    });
  });

  test("permite registrar sin datos de contacto opcionales", async () => {
    donanteRepository.crearDonante.mockResolvedValue({ id: 2 });

    await donanteService.registrarDonante({
      nombre: "Empresa X",
      tipo: "empresa",
    });

    expect(donanteRepository.crearDonante).toHaveBeenCalledWith({
      nombre: "Empresa X",
      tipo: "empresa",
      contacto: null,
      telefono: null,
      email: null,
    });
  });

  test("rechaza sin nombre", async () => {
    await expect(
      donanteService.registrarDonante({ tipo: "persona" }),
    ).rejects.toThrow("nombre es obligatorio");
    expect(donanteRepository.crearDonante).not.toHaveBeenCalled();
  });

  test("rechaza un tipo inválido", async () => {
    await expect(
      donanteService.registrarDonante({ nombre: "Juana Pérez", tipo: "ong" }),
    ).rejects.toThrow("tipo debe ser uno de: persona, empresa");
    expect(donanteRepository.crearDonante).not.toHaveBeenCalled();
  });

  test("lista donantes delegando al repositorio", async () => {
    donanteRepository.listarDonantes.mockResolvedValue([
      { id: 1, nombre: "Juana Pérez" },
    ]);

    const resultado = await donanteService.listarDonantes();

    expect(resultado).toEqual([{ id: 1, nombre: "Juana Pérez" }]);
  });
});
