export const ROLES = {
    ADMIN: "admin",
    PERSONAL: "personal",
    VISITANTE: "visitante",
};

export const ETIQUETAS_ROLES = {
    admin: "Administradora",
    personal: "Personal",
    visitante: "Visitante",
};

export const USUARIOS_DEMO = [
    {
        id: 1,
        nombre: "Administradora Amandita",
        correo: "admin@amandita.com",
        contrasena: "Amandita123",
        rol: ROLES.ADMIN,
    },
    {
        id: 2,
        nombre: "Personal Amandita",
        correo: "personal@amandita.com",
        contrasena: "Amandita123",
        rol: ROLES.PERSONAL,
    },
    {
        id: 3,
        nombre: "Visitante Amandita",
        correo: "visita@amandita.com",
        contrasena: "Amandita123",
        rol: ROLES.VISITANTE,
    },
];
