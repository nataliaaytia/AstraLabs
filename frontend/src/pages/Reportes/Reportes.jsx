import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import { TIPOS_REPORTE, construirReporte } from "../../data/reportes";
import "../InventarioComun.css";
import "./Reportes.css";

function Reportes({ navegar }) {
    const [datos, setDatos] = useState({ inventario: [], movimientos: [] });
    const [tipo, setTipo] = useState("inventario");
    const [filtros, setFiltros] = useState({ desde: "", hasta: "" });
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let activo = true;

        Promise.all([
            inventarioApi.listarArticulos(),
            inventarioApi.listarMovimientos(),
        ])
            .then(([inventario, movimientos]) => {
                if (activo) setDatos({ inventario, movimientos });
            })
            .catch((err) => {
                if (activo) setError(err.message);
            })
            .finally(() => {
                if (activo) setCargando(false);
            });

        return () => {
            activo = false;
        };
    }, []);

    const info = TIPOS_REPORTE.find((t) => t.valor === tipo);

    let reporte = null;
    let errorReporte = "";

    try {
        reporte = construirReporte(tipo, datos, filtros);
    } catch (err) {
        errorReporte = err.message;
    }

    const cambiarFiltro = (evento) => {
        setFiltros((anterior) => ({
            ...anterior,
            [evento.target.name]: evento.target.value,
        }));
    };

    return (
        <section className="inv-pagina reportes-pagina">
            <div className="inv-contenedor">
                <button
                    type="button"
                    className="inv-volver"
                    onClick={() => navegar("almacen")}
                >
                    ← Volver al almacén
                </button>

                <span className="inv-etiqueta">
                    ✦ CASA AMANDITA · ADMINISTRACIÓN
                </span>

                <h1 className="inv-titulo">
                    Nuestros <em>reportes.</em>
                </h1>

                <p className="inv-descripcion">
                    Prepara la información del almacén para
                    compartirla con el equipo, donantes o
                    instituciones aliadas.
                </p>

                {error && (
                    <div className="inv-mensaje error" role="alert">
                        ✕ {error}
                    </div>
                )}

                <div className="reportes-tipos">
                    {TIPOS_REPORTE.map((opcion) => (
                        <button
                            type="button"
                            key={opcion.valor}
                            className={`reportes-tipo ${tipo === opcion.valor ? "activo" : ""}`}
                            onClick={() => setTipo(opcion.valor)}
                            aria-pressed={tipo === opcion.valor}
                        >
                            <strong>{opcion.titulo}</strong>
                            <small>{opcion.descripcion}</small>
                        </button>
                    ))}
                </div>

                <div className="inv-tarjeta">
                    <div className="reportes-cabecera">
                        <div>
                            <h2>{info.titulo}</h2>
                            <p>
                                {reporte
                                    ? `${reporte.filas.length} registro(s) · generado ${reporte.generado}`
                                    : ""}
                            </p>
                        </div>
                    </div>

                    {info.usaFechas && (
                        <div className="reportes-fechas">
                            <div className="inv-campo">
                                <label htmlFor="reporte-desde">Desde</label>
                                <input
                                    id="reporte-desde"
                                    type="date"
                                    name="desde"
                                    value={filtros.desde}
                                    onChange={cambiarFiltro}
                                />
                            </div>

                            <div className="inv-campo">
                                <label htmlFor="reporte-hasta">Hasta</label>
                                <input
                                    id="reporte-hasta"
                                    type="date"
                                    name="hasta"
                                    value={filtros.hasta}
                                    onChange={cambiarFiltro}
                                />
                            </div>
                        </div>
                    )}

                    {errorReporte && (
                        <div className="inv-mensaje error" role="alert">
                            ✕ {errorReporte}
                        </div>
                    )}

                    {cargando ? (
                        <div className="inv-vacio">Preparando reporte...</div>
                    ) : reporte && reporte.filas.length === 0 ? (
                        <div className="inv-vacio">
                            No hay registros para este reporte.
                        </div>
                    ) : reporte && (
                        <div className="reportes-tabla-scroll">
                            <table className="reportes-tabla">
                                <thead>
                                    <tr>
                                        {reporte.columnas.map((columna) => (
                                            <th key={columna}>{columna}</th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody>
                                    {reporte.filas.map((fila, indice) => (
                                        <tr key={indice}>
                                            {fila.map((celda, j) => (
                                                <td key={j}>{celda}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default Reportes;
