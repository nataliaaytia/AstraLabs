
export const CATEGORIAS = [
    "Alimentos",
    "Medicamentos",
    "Higiene personal",
    "Limpieza",
    "Ropa",
    "Otros",
];

export const UNIDADES_MEDIDA = [
    "Unidad",
    "Paquete",
    "Caja",
    "Bolsa",
    "Botella",
    "Kilogramo",
    "Gramo",
    "Litro",
    "Mililitro",
];

export const CLAVE_CATALOGO = "amandita_catalogo";

export function cargarArticulos() {
    try {
        const datos = localStorage.getItem(CLAVE_CATALOGO);
        const articulos = datos ? JSON.parse(datos) : [];

        return Array.isArray(articulos) ? articulos : [];
    } catch {
        return [];
    }
}

export function guardarArticulos(articulos) {
    try {
        localStorage.setItem(
            CLAVE_CATALOGO,
            JSON.stringify(articulos)
        );

        return true;
    } catch {
        return false;
    }
}
