const donanteRepository = require("../repositories/donanteRepository");

const TIPOS_VALIDOS = ["persona", "empresa"];

/**
 * Servicio de Donantes (RF-14): registra un donante o empresa benefactora
 * para poder asociarlo luego al registrar entradas (RF-02).
 */
async function registrarDonante({ nombre, tipo, contacto, telefono, email }) {
  if (!nombre || !nombre.trim()) {
    throw new Error("nombre es obligatorio");
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new Error(`tipo debe ser uno de: ${TIPOS_VALIDOS.join(", ")}`);
  }

  return donanteRepository.crearDonante({
    nombre: nombre.trim(),
    tipo,
    contacto: contacto?.trim() || null,
    telefono: telefono?.trim() || null,
    email: email?.trim() || null,
  });
}

async function listarDonantes() {
  return donanteRepository.listarDonantes();
}

module.exports = { registrarDonante, listarDonantes };
