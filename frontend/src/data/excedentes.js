// HU-09 / RF-09: registro de excedentes (sin campos monetarios)

export const DESTINOS_EXCEDENTE = [
    "Donación a otra institución",
    "Redistribución a otra área",
    "Reserva para próxima semana",
    "Otro",
];

export const CLAVE_EXCEDENTES = "amandita_excedentes";

export function cargarExcedentes() {
    try {
        const datos = localStorage.getItem(CLAVE_EXCEDENTES);
        const excedentes = datos ? JSON.parse(datos) : [];

        return Array.isArray(excedentes) ? excedentes : [];
    } catch {
        return [];
    }
}

export function guardarExcedentes(excedentes) {
    try {
        localStorage.setItem(
            CLAVE_EXCEDENTES,
            JSON.stringify(excedentes)
        );

        return true;
    } catch {
        return false;
    }
}
