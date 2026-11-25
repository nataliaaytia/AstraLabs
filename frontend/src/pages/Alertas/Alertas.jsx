import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import {
    NOMBRES_NIVEL,
    cargarConfiguracion,
    generarAlertas,
    textoDias,
} from "../../data/alertas";
import "../InventarioComun.css";
import "./Alertas.css";

const FILTROS = [
    { valor: "todas", texto: "Todas" },
    { valor: "vencimiento", texto: "Vencimientos" },
    { valor: "stock", texto: "Stock mínimo" },
];

function Alertas({ navegar }) {
    const [alertas, setAlertas] = useState([]);
    const [configuracion] = useState(cargarConfiguracion);
    const [filtro, setFiltro] = useState("todas");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const obtenerAlertas = async () => {
        const inventario = await inventarioApi.listarArticulos();
        return generarAlertas(inventario, configuracion);
    };

    useEffect(() => {
        let activo = true;

        inventarioApi.listarArticulos()
            .then((inventario) => generarAlertas(inventario, configuracion))
            .then((lista) => {
                if (activo) setAlertas(lista);
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
    }, [configuracion]);

    const actualizar = async () => {
        setCargando(true);
        setError("");

        try {
            setAlertas(await obtenerAlertas());
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    };

    const deVencimiento = alertas.filter((a) => a.tipo === "vencimiento");
    const deStock = alertas.filter((a) => a.tipo === "stock");

    const urgentes = alertas.filter((a) =>
        ["vencido", "urgente", "agotado", "critico"].includes(a.nivel)
    ).length;

    const visibles = filtro === "todas"
        ? alertas
        : alertas.filter((a) => a.tipo === filtro);

    return (
        <section className="inv-pagina alertas-pagina">
            <div className="inv-contenedor">
                <button
                    type="button"
                    className="inv-volver"
                    onClick={() => navegar("almacen")}
                >
                    ← Volver al almacén
                </button>

                <div className="alertas-encabezado">
                    <div>
                        <span className="inv-etiqueta">
                            ✦ CASA AMANDITA · ADMINISTRACIÓN
                        </span>

                        <h1 className="inv-titulo">
                            Panel de <em>alertas.</em>
                        </h1>

                        <p className="inv-descripcion">
                            Todo lo que necesita nuestra atención en un
                            solo lugar: productos por vencer y artículos
                            que llegaron a su stock mínimo.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="inv-boton"
                        onClick={actualizar}
                        disabled={cargando}
                    >
                        ↻ Actualizar
                    </button>
                </div>

                {error && (
                    <div className="inv-mensaje error" role="alert">
                        ✕ {error}
                    </div>
                )}

                <div className="alertas-resumen">
                    <div className="alertas-resumen-card">
                        <span>Alertas activas</span>
                        <strong>{alertas.length}</strong>
                        <small>{urgentes} requieren acción inmediata</small>
                    </div>

                    <div className="alertas-resumen-card">
                        <span>Por vencer</span>
                        <strong>{deVencimiento.length}</strong>
                        <small>
                            En los próximos {configuracion.diasAnticipacion} días
                        </small>
                    </div>

                    <div className="alertas-resumen-card">
                        <span>Stock mínimo</span>
                        <strong>{deStock.length}</strong>
                        <small>Artículos por reponer</small>
                    </div>
                </div>

                <div className="inv-tarjeta">
                    <div className="alertas-barra">
                        <h2>Alertas activas</h2>

                        <div className="alertas-filtros" role="tablist">
                            {FILTROS.map((opcion) => (
                                <button
                                    type="button"
                                    key={opcion.valor}
                                    role="tab"
                                    aria-selected={filtro === opcion.valor}
                                    className={filtro === opcion.valor ? "activo" : ""}
                                    onClick={() => setFiltro(opcion.valor)}
                                >
                                    {opcion.texto}
                                </button>
                            ))}
                        </div>
                    </div>

                    {cargando ? (
                        <div className="inv-vacio">
                            Revisando el inventario...
                        </div>
                    ) : visibles.length === 0 ? (
                        <div className="alertas-vacio">
                            <span>♡</span>
                            <h3>Todo en orden por aquí</h3>
                            <p>No hay alertas activas en esta categoría.</p>
                        </div>
                    ) : (
                        <div className="alertas-lista">
                            {visibles.map((alerta) => (
                                <article
                                    key={alerta.id}
                                    className={`alertas-item ${alerta.nivel}`}
                                >
                                    <span className="alertas-item-icono">
                                        {alerta.tipo === "vencimiento" ? "◷" : "✧"}
                                    </span>

                                    <div className="alertas-item-cuerpo">
                                        <div className="alertas-item-superior">
                                            <strong>{alerta.articulo}</strong>

                                            <span className={`alertas-nivel ${alerta.nivel}`}>
                                                {NOMBRES_NIVEL[alerta.nivel]}
                                            </span>
                                        </div>

                                        {alerta.tipo === "vencimiento" ? (
                                            <p>
                                                Lote {alerta.codigoLote} ·{" "}
                                                {textoDias(alerta.dias)} ({alerta.fechaVencimiento}) ·{" "}
                                                {alerta.cantidad} {alerta.unidad}
                                            </p>
                                        ) : (
                                            <p>
                                                Disponible {alerta.actual} de un mínimo de{" "}
                                                {alerta.minimo} {alerta.unidad} · faltan{" "}
                                                {alerta.faltante} {alerta.unidad}
                                            </p>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default Alertas;
