
import "./PanelOperativo.css";

function PanelOperativo({ navegar }) {
    const opciones = [
        {
            titulo: "Consultar stock",
            descripcion: "Revisa las existencias de los artículos.",
            icono: "▦",
            pagina: "stock",
        },
        {
            titulo: "Registrar salida",
            descripcion: "Registra el consumo y destino de los artículos.",
            icono: "↗",
            pagina: "salidas",
        },
        {
            titulo: "Registrar merma",
            descripcion: "Documenta pérdidas y sus motivos.",
            icono: "✿",
            pagina: "mermas",
        },
    ];

    return (
        <section className="operativo-pagina">
            <div className="operativo-contenedor">
                <span className="inv-etiqueta">
                    ✦ CASA AMANDITA · ALMACÉN Y COCINA
                </span>

                <h1 className="inv-titulo">
                    Nuestro <em>almacén.</em>
                </h1>

                <p className="inv-descripcion">
                    Un espacio para consultar existencias y registrar
                    los movimientos de los recursos que cuidamos.
                </p>

                <div className="operativo-opciones">
                    {opciones.map((opcion) => (
                        <button
                            type="button"
                            className="operativo-tarjeta"
                            key={opcion.pagina}
                            onClick={() => navegar(opcion.pagina)}
                        >
                            <span className="operativo-icono">
                                {opcion.icono}
                            </span>

                            <h2>{opcion.titulo}</h2>
                            <p>{opcion.descripcion}</p>

                            <span className="operativo-flecha">↗</span>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default PanelOperativo;
