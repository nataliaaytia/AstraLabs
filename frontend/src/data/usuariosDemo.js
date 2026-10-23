
export const ROLES = {
    ADMIN: "Administradora",
    RECEPCION: "Recepcion",
    ALMACEN: "Almacen_Cocina",
};

export const ETIQUETAS_ROLES = {
    Administradora: "Administradora",
    Recepcion: "Recepción",
    Almacen_Cocina: "Almacén / Cocina",
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
        nombre: "Personal de Recepción",
        correo: "recepcion@amandita.com",
        contrasena: "Amandita123",
        rol: ROLES.RECEPCION,
    },
    {
        id: 3,
        nombre: "Personal de Almacén",
        correo: "almacen@amandita.com",
        contrasena: "Amandita123",
        rol: ROLES.ALMACEN,
    },
];
