const API_URL = (
    import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

const CLAVE_TOKEN = "astralabs_token";
const CLAVE_USUARIO = "astralabs_usuario";

// Claves de la versión anterior (datos de prueba en el navegador).
const CLAVES_ANTIGUAS = [
    "amandita_123",
    "callatericardo",
    "amandita_stock_demo_v1",
    "amandita_catalogo_demo",
    "amandita_movimientos_demo_v1",
    "amandita_catalogo",
    "amandita_excedentes",
];

try {
    CLAVES_ANTIGUAS.forEach((clave) => localStorage.removeItem(clave));
} catch {
    // Sin acceso a localStorage: no pasa nada.
}

function tokenVigente(token) {
    try {
        const carga = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const { exp } = JSON.parse(atob(carga));
        return !exp || exp * 1000 > Date.now();
    } catch {
        return false;
    }
}

export function limpiarSesion() {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
}

export function obtenerToken() {
    const token = localStorage.getItem(CLAVE_TOKEN);

    if (!token) return null;

    if (!tokenVigente(token)) {
        limpiarSesion();
        return null;
    }

    return token;
}

export function obtenerUsuarioGuardado() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE_USUARIO)) || null;
    } catch {
        return null;
    }
}

export function guardarSesion({ token, usuario }) {
    localStorage.setItem(CLAVE_TOKEN, token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
}

let alExpirarSesion = null;

export function registrarAlExpirarSesion(funcion) {
    alExpirarSesion = funcion;
}

export async function solicitar(ruta, opciones = {}) {
    const token = obtenerToken();
    let respuesta;

    try {
        respuesta = await fetch(`${API_URL}${ruta}`, {
            ...opciones,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...opciones.headers,
            },
        });
    } catch {
        throw new Error(
            "No hay conexión con el servidor. Verifica que el backend esté encendido."
        );
    }

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
        // Token vencido o inválido en una petición autenticada.
        if (respuesta.status === 401 && token) {
            limpiarSesion();
            if (alExpirarSesion) alExpirarSesion();
        }

        throw new Error(
            datos.error || `Error del servidor (${respuesta.status})`
        );
    }

    return datos;
}
