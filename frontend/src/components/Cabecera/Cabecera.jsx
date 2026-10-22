
import { useState } from "react";
import "./Cabecera.css";

function Cabecera({ paginaActual, navegar }) {
    const [menuAbierto, setMenuAbierto] = useState(false);

    const cambiarPagina = (pagina) => {
        navegar(pagina);
        setMenuAbierto(false);
    };

    return (
        <header className="cabecera">
            <div className="cabecera-contenedor">

                <button
                    className="cabecera-logo"
                    onClick={() => cambiarPagina("home")}
                    aria-label="Ir al inicio"
                >
                    <span className="cabecera-logo-icono">
                        {/*no se asusten hijas esto es pal logo */}
                        <svg
                            viewBox="0 0 48 48"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M6 23L24 8L42 23" />
                            <path d="M11 20V40H37V20" />
                            <path d="M24 34S14 28 17 22C19 18 23 20 24 23C25 20 29 18 31 22C34 28 24 34 24 34Z" />
                        </svg>
                    </span>

                    <span className="cabecera-logo-texto">
                        <strong>Casa Amandita</strong>
                        <small>del adulto mayor</small>
                    </span>
                </button>

                <button
                    className="cabecera-menu-toggle"
                    onClick={() => setMenuAbierto(!menuAbierto)}
                    aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
                    aria-expanded={menuAbierto}
                >
                    <span />
                    <span />
                    <span />
                </button>

                <nav
                    className={`cabecera-navegacion ${menuAbierto ? "cabecera-navegacion-abierta" : ""
                        }`}
                    aria-label="Navegación principal"
                >
                    <button
                        className={`cabecera-enlace ${paginaActual === "home" ? "activo" : ""
                            }`}
                        onClick={() => cambiarPagina("home")}
                    >
                        Inicio
                    </button>

                    <button
                        className={`cabecera-enlace ${paginaActual === "almacen" ? "activo" : ""
                            }`}
                        onClick={() => cambiarPagina("almacen")}
                    >
                        Almacén
                    </button>

                    <button
                        className="cabecera-boton-login"
                        onClick={() => cambiarPagina("login")}
                    >
                        Iniciar sesión
                    </button>
                </nav>

            </div>
        </header>
    );
}

export default Cabecera;
