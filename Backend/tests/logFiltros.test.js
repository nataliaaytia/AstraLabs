const { construirEntrada } = require("../src/middleware/logFiltros");

const res = { statusCode: 200 };
const req = (extra) => ({
  method: "GET",
  originalUrl: "/api/articulos?q=arroz",
  query: { q: "arroz" },
  usuario: { id: 7, rol: "Recepcion" },
  ...extra,
});

describe("construirEntrada", () => {
  test("registra filtros, usuario y ruta sin querystring", () => {
    const e = construirEntrada(req(), res);
    expect(e).toMatchObject({
      usuarioId: 7,
      rol: "Recepcion",
      ruta: "/api/articulos",
      filtros: { q: "arroz" },
      status: 200,
    });
  });
  test("ignora GET sin filtros", () => {
    expect(construirEntrada(req({ query: {} }), res)).toBeNull();
  });
  test("ignora métodos que no son GET", () => {
    expect(construirEntrada(req({ method: "POST" }), res)).toBeNull();
  });
  test("trunca valores largos", () => {
    const e = construirEntrada(req({ query: { q: "x".repeat(500) } }), res);
    expect(e.filtros.q).toHaveLength(100);
  });
});
