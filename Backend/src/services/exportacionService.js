const catalogoService = require("./catalogoService");
const menuService = require("./menuService");
const planComidaService = require("./planComidaService");
const reporteService = require("./reporteService");
const exportService = require("./exportService");

/**
 * Exportaciones (RF-24). Cada función toma los MISMOS filtros que el listado
 * de su pantalla, consulta a través del servicio de ese listado y arma el
 * contenido propio de esa pantalla; el archivo lo genera exportService.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const ORDEN_COMIDA = ["desayuno", "almuerzo", "merienda"];

function rangoDelMes(mes) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mes || "");
  if (!m) throw new Error("mes debe tener formato YYYY-MM");
  const anio = Number(m[1]);
  const numero = Number(m[2]);
  const ultimoDia = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  return {
    desde: `${mes}-01`,
    hasta: `${mes}-${String(ultimoDia).padStart(2, "0")}`,
    etiqueta: `${MESES[numero - 1]} ${anio}`,
  };
}

const fechaCorta = (iso) => String(iso).split("-").reverse().join("/");
const capitalizar = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");

async function exportarArticulos({ formato, categoriaId, q, bajoMinimo }) {
  exportService.validarFormato(formato);
  const articulos = await catalogoService.listarArticulos({
    categoriaId,
    q,
    bajoMinimo,
  });

  const filtros = [];
  if (q) filtros.push(`nombre contiene "${q}"`);
  if (categoriaId) {
    filtros.push(`categoría: ${articulos[0]?.categoria ?? `#${categoriaId}`}`);
  }
  if (bajoMinimo) filtros.push("solo artículos bajo el stock mínimo");

  return exportService.generarArchivo(formato, {
    titulo: "Catálogo de artículos",
    hoja: "Artículos",
    nombreBase: "articulos",
    filtros: filtros.join(" · "),
    columnas: [
      { clave: "nombre", titulo: "Artículo", ancho: 28 },
      { clave: "categoria", titulo: "Categoría", ancho: 16 },
      { clave: "unidad", titulo: "Unidad", ancho: 10 },
      { clave: "perecedero", titulo: "Perecedero", ancho: 12 },
      { clave: "stock_actual", titulo: "Stock actual", ancho: 13, tipo: "numero" },
      { clave: "stock_minimo", titulo: "Stock mínimo", ancho: 13, tipo: "numero" },
      { clave: "estado", titulo: "Estado", ancho: 15 },
    ],
    filas: articulos.map((a) => ({
      nombre: a.nombre,
      categoria: a.categoria,
      unidad: a.unidad_medida,
      perecedero: a.es_perecedero ? "Sí" : "No",
      stock_actual: Number(a.stock_actual),
      stock_minimo: Number(a.stock_minimo),
      estado:
        Number(a.stock_actual) < Number(a.stock_minimo)
          ? "Bajo el mínimo"
          : "Normal",
    })),
  });
}

async function exportarMenus({ formato, q }) {
  exportService.validarFormato(formato);
  const [menus, articulos] = await Promise.all([
    menuService.listarMenus({ q }),
    catalogoService.listarArticulos({}),
  ]);
  const porId = new Map(articulos.map((a) => [Number(a.id), a]));

  // Una fila por ingrediente; el PDF no repite el nombre del menú consecutivo.
  const filas = [];
  for (const menu of menus) {
    for (const ing of menu.ingredientes) {
      const art = porId.get(Number(ing.articuloId));
      filas.push({
        menu: menu.nombre,
        descripcion: menu.descripcion || "",
        ingrediente: art ? art.nombre : `Artículo #${ing.articuloId}`,
        cantidad: Number(ing.cantidadPorPorcion),
        unidad: art ? art.unidad_medida : "",
      });
    }
  }

  return exportService.generarArchivo(formato, {
    titulo: "Menús y sus ingredientes",
    hoja: "Menús",
    nombreBase: "menus",
    filtros: q ? `nombre contiene "${q}"` : "",
    agruparColumnas: ["menu", "descripcion"],
    columnas: [
      { clave: "menu", titulo: "Menú", ancho: 22 },
      { clave: "descripcion", titulo: "Descripción", ancho: 24 },
      { clave: "ingrediente", titulo: "Ingrediente", ancho: 24 },
      { clave: "cantidad", titulo: "Cantidad por porción", ancho: 16, tipo: "numero" },
      { clave: "unidad", titulo: "Unidad", ancho: 10 },
    ],
    filas,
  });
}

async function exportarPlanes({
  formato,
  mes,
  fecha,
  desde,
  hasta,
  tipoComida,
  estado,
}) {
  exportService.validarFormato(formato);

  const filtros = [];
  if (mes) {
    if (fecha || desde || hasta) {
      throw new Error("usa 'mes' o 'fecha/desde/hasta', no ambos");
    }
    const rango = rangoDelMes(mes);
    desde = rango.desde;
    hasta = rango.hasta;
    filtros.push(`mes: ${rango.etiqueta}`);
  } else {
    if (fecha) filtros.push(`fecha: ${fechaCorta(fecha)}`);
    if (desde) filtros.push(`desde: ${fechaCorta(desde)}`);
    if (hasta) filtros.push(`hasta: ${fechaCorta(hasta)}`);
  }
  if (tipoComida) filtros.push(`tipo de comida: ${tipoComida}`);
  if (estado) filtros.push(`estado: ${estado}`);

  const planes = await planComidaService.listarPlanes({
    fecha: mes ? undefined : fecha,
    desde,
    hasta,
    tipoComida,
    estado,
  });

  // Cronológico: por fecha y, dentro del día, desayuno → almuerzo → merienda
  const ordenados = [...planes].sort(
    (a, b) =>
      String(a.fecha).localeCompare(String(b.fecha)) ||
      ORDEN_COMIDA.indexOf(a.tipo_comida) - ORDEN_COMIDA.indexOf(b.tipo_comida),
  );

  return exportService.generarArchivo(formato, {
    titulo: "Plan de comidas",
    hoja: "Plan de comidas",
    nombreBase: "plan_comidas",
    filtros: filtros.join(" · "),
    agruparColumnas: ["fecha"],
    columnas: [
      { clave: "fecha", titulo: "Fecha", ancho: 14 },
      { clave: "tipo", titulo: "Comida", ancho: 14 },
      { clave: "menu", titulo: "Menú", ancho: 30 },
      { clave: "comensales", titulo: "Comensales", ancho: 13, tipo: "entero" },
      { clave: "estado", titulo: "Estado", ancho: 14 },
    ],
    filas: ordenados.map((p) => ({
      fecha: fechaCorta(p.fecha),
      tipo: capitalizar(p.tipo_comida),
      menu: p.menu,
      comensales: p.comensales,
      estado: capitalizar(p.estado),
    })),
  });
}

async function exportarNecesidadesCriticas({ formato, limite }) {
  exportService.validarFormato(formato);
  const datos = await reporteService.obtenerNecesidadesCriticas({ limite });

  return exportService.generarArchivo(formato, {
    titulo: "Reporte de necesidades críticas",
    hoja: "Necesidades críticas",
    nombreBase: "necesidades_criticas",
    filtros: limite ? `máximo ${limite} artículos` : "",
    columnas: [
      { clave: "articulo", titulo: "Artículo", ancho: 30 },
      { clave: "stock_actual", titulo: "Stock actual", ancho: 14, tipo: "numero" },
      { clave: "stock_minimo", titulo: "Stock mínimo", ancho: 14, tipo: "numero" },
      { clave: "deficit", titulo: "Faltante", ancho: 14, tipo: "numero" },
      { clave: "porcentaje_cubierto", titulo: "% cubierto", ancho: 12, tipo: "entero" },
    ],
    filas: datos,
  });
}

module.exports = {
  exportarArticulos,
  exportarMenus,
  exportarPlanes,
  exportarNecesidadesCriticas,
};
