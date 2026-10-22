
import "./Almacen.css";

function Almacen({ navegar }) {
    return (
        <section className="almacen">
            <div className="almacen-contenido">

                <div className="almacen-icono" aria-hidden="true">
                    ♡
                </div>

                <span className="almacen-etiqueta">
                    CASA AMANDITA · GESTIÓN INTERNA
                </span>

                <h1>
                    Nuestro <em>almacén</em>
                </h1>

                <p>
                    Un espacio para organizar y cuidar los recursos
                    que hacen posible el bienestar de nuestra familia.
                </p>

                <div className="almacen-aviso">
                    <span aria-hidden="true">✿</span>
                    Estamos preparando este espacio con mucho cariño.
                    <br />
                    ¡Próximamente!
                </div>

                <button onClick={() => navegar("home")}>
                    ← Volver al inicio
                </button>
            </div>
        </section>
    );
}

export default Almacen;
