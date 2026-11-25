import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import {
    NOMBRES_NIVEL,
    OPCIONES_ANTICIPACION,
    cargarConfiguracion,
    depurarAtendidas,
    generarAlertas,
    guardarConfiguracion,
    marcarAtendida,
    reactivarAlerta,
    textoDias,
} from "../../data/alertas";
import "../InventarioComun.css";
import "./Alertas.css";

const FILTROS = [
    { valor: "todas", texto: "Todas" },
    { valor: "vencimiento", texto: "Vencimientos" },
    { valor: "stock", texto: "Stock mínimo" },
    { valor: "atendidas", texto: "Atendidas" },
];

function Alertas({ navegar, usuarioActual }) {
    const [todas, setTodas] = useState([]);
    const [atendidas, setAtendidas] = useState({});
    const [mensaje, setMensaje] = useState("");
    const [configuracion, setConfiguracion] = useState(cargarConfiguracion);
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
                if (activo) {
                    setTodas(lista);
                    setAtendidas(depurarAtendidas(lista));
                }
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
            const lista = await obtenerAlertas();

            setTodas(lista);
            setAtendidas(depurarAtendidas(lista));
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    };

    const cambiarAnticipacion = (evento) => {
        try {
            const nueva = guardarConfiguracion({
                diasAnticipacion: evento.target.value,
            });

            setCargando(true);
            setConfiguracion(nueva);
            setMensaje(
                `Ahora verás los vencimientos de los próximos ${nueva.diasAnticipacion} días.`
            );
        } catch (err) {
            setError(err.message);
        }
    };

    const atender = (alerta) => {
        setAtendidas({ ...marcarAtendida(alerta.id, usuarioActual?.nombre) });
        setMensaje(`La alerta de ${alerta.articulo} se marcó como atendida.`);
    };

    const reactivar = (alerta) => {
        setAtendidas({ ...reactivarAlerta(alerta.id) });
        setMensaje(`La alerta de ${alerta.articulo} volvió a estar activa.`);
    };

    const alertas = todas.filter((a) => !atendidas[a.id]);
    const yaAtendidas = todas.filter((a) => atendidas[a.id]);

    const deVencimiento = alertas.filter((a) => a.tipo === "vencimiento");
    const deStock = alertas.filter((a) => a.tipo === "stock");

    const urgentes = alertas.filter((a) =>
        ["vencido", "urgente", "agotado", "critico"].includes(a.nivel)
    ).length;

    const visibles = filtro === "todas"
        ? alertas
        : filtro === "atendidas"
            ? yaAtendidas
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

                <div className="alertas-configuracion">
                    <span aria-hidden="true">◷</span>

                    <div>
                        <strong>Anticipación de vencimientos</strong>
                        <p>
                            ¿Con cuántos días de anticipación quieres
                            enterarte de los productos por vencer?
                        </p>
                    </div>

                    <select
                        value={configuracion.diasAnticipacion}
                        onChange={cambiarAnticipacion}
                        aria-label="Días de anticipación"
                    >
                        {OPCIONES_ANTICIPACION.map((dias) => (
                            <option key={dias} value={dias}>
                                {dias} días antes
                            </option>
                        ))}
                    </select>
                </div>

                {mensaje && (
                    <div className="inv-mensaje exito" role="status">
                        ✓ {mensaje}
                    </div>
                )}

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
                                    {opcion.valor === "atendidas" &&
                                        yaAtendidas.length > 0 &&
                                        ` (${yaAtendidas.length})`}
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
                            <h3>
                                {filtro === "atendidas"
                                    ? "Sin alertas atendidas"
                                    : "Todo en orden por aquí"}
                            </h3>
                            <p>
                                {filtro === "atendidas"
                                    ? "Las alertas que marques como atendidas aparecerán aquí."
                                    : "No hay alertas activas en esta categoría."}
                            </p>
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

                                        <div className="alertas-item-acciones">
                                            {atendidas[alerta.id] ? (
                                                <>
                                                    <small>
                                                        Atendida el{" "}
                                                        {new Date(
                                                            atendidas[alerta.id].fecha
                                                        ).toLocaleDateString("es-BO")}
                                                        {atendidas[alerta.id].usuario &&
                                                            ` por ${atendidas[alerta.id].usuario}`}
                                                    </small>

                                                    <button
                                                        type="button"
                                                        onClick={() => reactivar(alerta)}
                                                    >
                                                        Reactivar
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {alerta.tipo === "stock" && (
                                                        <button
                                                            type="button"
                                                            className="secundario"
                                                            onClick={() => navegar("stockMinimo")}
                                                        >
                                                            Ajustar mínimo
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => atender(alerta)}
                                                    >
                                                        ✓ Marcar atendida
                                                    </button>
                                                </>
                                            )}
                                        </div>
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
