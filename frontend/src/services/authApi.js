import { solicitar } from "./api";

export const authApi = {
    login(email, password) {
        return solicitar("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
    },

    listarUsuarios() {
        return solicitar("/api/usuarios");
    },

    cambiarRol(usuarioId, rol) {
        return solicitar(`/api/usuarios/${usuarioId}/rol`, {
            method: "PATCH",
            body: JSON.stringify({ rol }),
        });
    },
};
