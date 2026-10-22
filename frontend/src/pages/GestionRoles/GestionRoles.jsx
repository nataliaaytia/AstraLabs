
import { useState } from "react";
import {
    ROLES,
    ETIQUETAS_ROLES,
} from "../../data/usuariosDemo";

import "./GestionRoles.css";

function GestionRoles({
    usuarios,
    usuarioActual,
    cambiarRol,
}) {
    const [mensaje, setMensaje] = useState(null);

    const asignarRol = (usuarioId, nuevoRol) => {
        const resultado = cambiarRol(usuarioId, nuevoRol);

        setMensaje({
            texto: resultado.mensaje,
            tipo: resultado.exito ? "exito" : "error",
        });
    };

    return (
        <section className="roles-pagina">
            <div className="roles-contenedor">

                <div className="roles-encabezado">
                    <span className="roles-etiqueta">
                        ✦ ADMINISTRACIÓN DEL SISTEMA
                    </span>

                    <h1>
                        Gestión de <em>roles.</em>
                    </h1>

                    <p>
                        Administra los permisos de acceso de los usuarios
                        de Casa Amandita para que cada persona tenga
                        acceso únicamente a las funciones que le corresponden.
                    </p>
                </div>

                <div className="roles-resumen">
                    <div className="roles-resumen-item">
                        <span>Total de usuarios</span>
                        <strong>{usuarios.length}</strong>
                    </div>

                    <div className="roles-resumen-item">
                        <span>Administradoras</span>
                        <strong>
                            {usuarios.filter((u) => u.rol === ROLES.ADMIN).length}
                        </strong>
                    </div>

                    <div className="roles-resumen-item">
                        <span>Personal</span>
                        <strong>
                            {usuarios.filter((u) => u.rol === ROLES.PERSONAL).length}
                        </strong>
                    </div>

                    <div className="roles-resumen-item">
                        <span>Visitantes</span>
                        <strong>
                            {usuarios.filter((u) => u.rol === ROLES.VISITANTE).length}
                        </strong>
                    </div>
                </div>

                <div className="roles-tarjeta">
                    <div className="roles-tarjeta-encabezado">
                        <div>
                            <h2>Usuarios del sistema</h2>
                            <p>
                                Selecciona un rol para actualizar sus permisos.
                            </p>
                        </div>

                        <span className="roles-total">
                            {usuarios.length} usuarios
                        </span>
                    </div>

                    {mensaje && (
                        <div
                            className={`roles-mensaje roles-mensaje-${mensaje.tipo}`}
                            role="status"
                        >
                            <span aria-hidden="true">
                                {mensaje.tipo === "exito" ? "✓" : "✕"}
                            </span>
                            {mensaje.texto}

                            <button
                                onClick={() => setMensaje(null)}
                                aria-label="Cerrar mensaje"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <div className="roles-tabla-contenedor">
                        <table className="roles-tabla">
                            <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Rol actual</th>
                                    <th>Asignar rol</th>
                                </tr>
                            </thead>

                            <tbody>
                                {usuarios.map((usuario) => {
                                    const esCuentaActual =
                                        usuario.id === usuarioActual.id;

                                    return (
                                        <tr key={usuario.id}>
                                            <td>
                                                <div className="roles-usuario">
                                                    <div className="roles-avatar">
                                                        {usuario.nombre.charAt(0)}
                                                    </div>

                                                    <div className="roles-usuario-datos">
                                                        <strong>{usuario.nombre}</strong>
                                                        <small>{usuario.correo}</small>
                                                    </div>
                                                </div>
                                            </td>

                                            <td>
                                                <span
                                                    className={`roles-badge roles-badge-${usuario.rol}`}
                                                >
                                                    {ETIQUETAS_ROLES[usuario.rol]}
                                                </span>
                                            </td>

                                            <td>
                                                <select
                                                    className="roles-selector"
                                                    value={usuario.rol}
                                                    disabled={esCuentaActual}
                                                    aria-label={`Asignar rol a ${usuario.nombre}`}
                                                    onChange={(e) =>
                                                        asignarRol(usuario.id, e.target.value)
                                                    }
                                                    title={
                                                        esCuentaActual
                                                            ? "No puedes modificar tu propio rol"
                                                            : "Seleccionar un rol"
                                                    }
                                                >
                                                    <option value={ROLES.ADMIN}>
                                                        Administradora
                                                    </option>

                                                    <option value={ROLES.PERSONAL}>
                                                        Personal
                                                    </option>

                                                    <option value={ROLES.VISITANTE}>
                                                        Visitante
                                                    </option>
                                                </select>

                                                {esCuentaActual && (
                                                    <small className="roles-cuenta-actual">
                                                        Tu cuenta
                                                    </small>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="roles-permisos">
                    <h2>Permisos por rol</h2>

                    <div className="roles-permisos-grid">
                        <div className="roles-permiso-card">
                            <span className="roles-permiso-icono">✿</span>
                            <h3>Administradora</h3>
                            <p>
                                Acceso al inicio, almacén y gestión de roles.
                                Puede asignar permisos a otros usuarios.
                            </p>
                        </div>

                        <div className="roles-permiso-card">
                            <span className="roles-permiso-icono">♡</span>
                            <h3>Personal</h3>
                            <p>
                                Puede iniciar sesión y visualizar el inicio.
                                No puede acceder al almacén ni gestionar roles.
                            </p>
                        </div>

                        <div className="roles-permiso-card">
                            <span className="roles-permiso-icono">✧</span>
                            <h3>Visitante</h3>
                            <p>
                                Puede consultar el contenido público,
                                sin acceso a funciones administrativas.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
}

export default GestionRoles;
