const menuRepository = require("../repositories/menuRepository");

/**
 * Servicio de Menús (RF-16): registra un menú con sus ingredientes y
 * cantidad por porción, para reutilizarlo al planificar (RF-17).
 */
async function listarMenus() {
  return menuRepository.listarMenus();
}

async function obtenerMenu(menuId) {
  const menu = await menuRepository.obtenerMenuConIngredientes(menuId);
  if (!menu) {
    throw new Error("El menú no existe");
  }
  return menu;
}

async function registrarMenu({ nombre, descripcion, ingredientes }) {
  if (!nombre || !nombre.trim()) {
    throw new Error("nombre es obligatorio");
  }
  if (!Array.isArray(ingredientes) || ingredientes.length === 0) {
    throw new Error("el menú debe tener al menos un ingrediente");
  }

  const articulosVistos = new Set();
  const ingredientesLimpios = ingredientes.map((ing, indice) => {
    if (!ing.articuloId) {
      throw new Error(`ingrediente #${indice + 1}: articuloId es obligatorio`);
    }
    const cantidad = Number(ing.cantidadPorPorcion);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error(
        `ingrediente #${indice + 1}: cantidadPorPorcion debe ser mayor a cero`,
      );
    }
    if (articulosVistos.has(ing.articuloId)) {
      throw new Error(
        `el artículo ${ing.articuloId} está repetido en los ingredientes`,
      );
    }
    articulosVistos.add(ing.articuloId);

    return { articuloId: ing.articuloId, cantidadPorPorcion: cantidad };
  });

  try {
    return await menuRepository.crearMenu({
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      ingredientes: ingredientesLimpios,
    });
  } catch (err) {
    if (err.code === "23503") {
      throw new Error("Uno de los artículos seleccionados no existe");
    }
    throw err;
  }
}

module.exports = { listarMenus, obtenerMenu, registrarMenu };
