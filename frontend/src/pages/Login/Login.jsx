
import { useState } from "react";
import "./Login.css";

function Login({ navegar, iniciarSesion }) {
    const [correo, setCorreo] = useState("");
    const [contrasena, setContrasena] = useState("");
    const [mostrarContrasena, setMostrarContrasena] = useState(false);
    const [error, setError] = useState("");

    const manejarIngreso = (e) => {
        e.preventDefault();
        setError("");

        const resultado = iniciarSesion(correo, contrasena);

        if (!resultado.exito) {
            setError(resultado.mensaje);
        }
    };

    return (
        <section className="login">
            <div className="login-contenedor">

                <div className="login-decoracion">
                    <span className="login-decoracion-corazon">౨ৎ⋆˚｡⋆</span>
                    <h2>Un espacio creado con amor.</h2>
                    <p>
                        Cuidando cada detalle para quienes más lo necesitan.
                    </p>
                    <span className="login-decoracion-flores">✿ ❀ ✿</span>
                </div>

                <div className="login-formulario-contenedor">

                    <span className="login-etiqueta">
                        BIENVENIDO
                    </span>

                    <h1>
                        Que alegría
                        <br />
                        <em>tenerte aquí.</em>
                    </h1>

                    <p className="login-descripcion">
                        Ingresa tus datos para acceder a tu espacio de trabajo.
                    </p>

                    <form className="login-formulario" onSubmit={manejarIngreso}>

                        <div className="login-campo">
                            <label htmlFor="correo">Correo electrónico</label>
                            <input
                                id="correo"
                                type="email"
                                placeholder="nombre@ejemplo.com"
                                value={correo}
                                onChange={(e) => setCorreo(e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="login-campo">
                            <label htmlFor="contrasena">Contraseña</label>

                            <div className="login-password">
                                <input
                                    id="contrasena"
                                    type={mostrarContrasena ? "text" : "password"}
                                    placeholder="Ingresa tu contraseña"
                                    value={contrasena}
                                    onChange={(e) => setContrasena(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        setMostrarContrasena(!mostrarContrasena)
                                    }
                                    aria-label={
                                        mostrarContrasena
                                            ? "Ocultar contraseña"
                                            : "Mostrar contraseña"
                                    }
                                >
                                    {mostrarContrasena ? "Ocultar" : "Mostrar"}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="login-error" role="alert">
                                <span aria-hidden="true">✕</span>
                                {error}
                            </div>
                        )}

                        <button type="submit" className="login-boton">
                            Iniciar sesión
                            <span aria-hidden="true">→</span>
                        </button>

                    </form>

                    <button
                        className="login-volver"
                        onClick={() => navegar("home")}
                    >
                        ← Volver al inicio
                    </button>

                </div>
            </div>
        </section>
    );
}

export default Login;
