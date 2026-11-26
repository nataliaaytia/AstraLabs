import { useCallback, useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import {
    NOMBRES_NIVEL,
    OPCIONES_ANTICIPACION,
    normalizarAlerta,
    ordenarAlertas,
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

function Alertas({ navegar }) {
    const [todas, setTodas] = useState([]);
    const [diasAnticipacion, setDiasAnticipacion] = useState(null);
    const [mensaje, setMensaje] = useState("");
    const [filtro, setFiltro] = useState("todas");
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState(false);
    const [error, setError] = useState("");

    // El backend sincroniza las alertas con el inventario antes de responder.
    const obtenerDatos = useCallback(async () => {
        const [panel, umbral, lotes] = await Promise.all([
            inventarioApi.listarAlertas(),
            inventarioApi.obtenerUmbralVencimiento(),
            inventarioApi.listarLotes(),
        ]);

        return {
            lista: panel.alertas.map((a) => normalizarAlerta(a, lotes)),
            dias: umbral.dias,
        };
    }, []);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");

        try {
            const { lista, dias } = await obtenerDatos();

            setTodas(lista);
            setDiasAnticipacion(dias);
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    }, [obtenerDatos]);

    useEffect(() => {
        let activo = true;

        obtenerDatos()
            .then(({ lista, dias }) => {
                if (!activo) return;

                setTodas(lista);
                setDiasAnticipacion(dias);
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
    }, [obtenerDatos]);

    const actualizar = () => {
        setMensaje("");
        cargar();
    };

    const cambiarAnticipacion = async (evento) => {
        const dias = Number(evento.target.value);

        setProcesando(true);
        setError("");
        setMensaje("");

        try {
            await inventarioApi.configurarUmbralVencimiento(dias);
            await cargar();
            setMensaje(
                `Ahora verás los vencimientos de los próximos ${dias} días.`
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setProcesando(false);
        }
    };

    const atender = async (alerta) => {
        setProcesando(true);
        setError("");
        setMensaje("");

        try {
            await inventarioApi.atenderAlerta(alerta.id);
            await cargar();
            setMensaje(`La alerta de ${alerta.articulo} se marcó como atendida.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setProcesando(false);
        }
    };

    const alertas = ordenarAlertas(
        todas.filter((a) => a.estado === "pendiente")
    );
    const yaAtendidas = todas.filter((a) => a.estado === "atendida");

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

    // Si el umbral guardado no es una de las opciones, se agrega para mostrarlo.
    const opcionesAnticipacion = OPCIONES_ANTICIPACION.includes(diasAnticipacion)
        || diasAnticipacion === null
        ? OPCIONES_ANTICIPACION
        : [...OPCIONES_ANTICIPACION, diasAnticipacion].sort((a, b) => a - b);

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
                            En los próximos {diasAnticipacion ?? "—"} días
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
                        value={diasAnticipacion ?? ""}
                        onChange={cambiarAnticipacion}
                        disabled={diasAnticipacion === null || procesando}
                        aria-label="Días de anticipación"
                    >
                        {opcionesAnticipacion.map((dias) => (
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
                                                {textoDias(alerta.dias)} ({alerta.fechaVencimiento})
                                                {alerta.cantidad !== null &&
                                                    ` · ${alerta.cantidad} ${alerta.unidad}`}
                                            </p>
                                        ) : (
                                            <p>
                                                Disponible {alerta.actual} de un mínimo de{" "}
                                                {alerta.minimo} {alerta.unidad} · faltan{" "}
                                                {alerta.faltante} {alerta.unidad}
                                            </p>
                                        )}

                                        <div className="alertas-item-acciones">
                                            {alerta.estado === "atendida" ? (
                                                <small>
                                                    {alerta.atendidaPor
                                                        ? `Atendida el ${new Date(
                                                            alerta.fechaAtendida
                                                        ).toLocaleDateString("es-BO")} por ${alerta.atendidaPor}`
                                                        : "Se resolvió sola: el inventario ya está en orden."}
                                                </small>
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
                                                        disabled={procesando}
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
