
import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import "../InventarioComun.css";
import "./NecesidadesCriticas.css";

function NecesidadesCriticas({ navegar }) {
    const [articulos, setArticulos] = useState([]);
    const [filtro, setFiltro] = useState("todos");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");

    const cargarReporte = async () => {
        setCargando(true);
        setError("");

        try {
            const datos = await inventarioApi.listarArticulos();

            if (!Array.isArray(datos)) {
                throw new Error("No se pudo obtener el inventario.");
            }

            setArticulos(datos);
        } catch (err) {
            setArticulos([]);
            setError(err.message);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarReporte();
    }, []);

    const reporte = articulos.map((articulo) => {
        const actual = Number(articulo.stock_actual) || 0;
        const minimo = Number(articulo.stock_minimo) || 0;
        const faltante = Math.max(0, minimo - actual);

        const porcentajeFaltante = minimo > 0
            ? Math.min(100, (faltante / minimo) * 100)
            : 0;

        let estado = "saludable";

        if (minimo <= 0) {
            estado = "sin-minimo";
        } else if (actual === 0) {
            estado = "agotado";
        } else if (actual <= minimo * 0.5) {
            estado = "critico";
        } else if (actual < minimo) {
            estado = "bajo";
        }

        return {
            ...articulo,
            actual,
            minimo,
            faltante,
            porcentajeFaltante,
            estado,
        };
    });

    const prioridades = reporte
        .filter((a) => a.faltante > 0)
        .sort((a, b) =>
            b.porcentajeFaltante - a.porcentajeFaltante ||
            b.faltante - a.faltante ||
            a.nombre.localeCompare(b.nombre)
        );

    const agotados = prioridades.filter(
        (a) => a.estado === "agotado"
    ).length;

    const criticos = prioridades.filter(
        (a) => a.estado === "critico" ||
            a.estado === "agotado"
    ).length;

    const saludables = reporte.filter(
        (a) => a.estado === "saludable"
    ).length;

    const sinMinimo = reporte.filter(
        (a) => a.estado === "sin-minimo"
    ).length;

    const visibles = prioridades.filter((articulo) => {
        if (filtro === "todos") return true;
        if (filtro === "criticos") {
            return ["critico", "agotado"].includes(articulo.estado);
        }
        return articulo.estado === filtro;
    });

    const nombreEstado = (estado) => {
        const nombres = {
            agotado: "Agotado",
            critico: "Crítico",
            bajo: "Stock bajo",
            saludable: "Saludable",
            "sin-minimo": "Sin mínimo definido",
        };

        return nombres[estado] || estado;
    };

    const formatear = (numero) =>
        Number(numero.toFixed(3)).toLocaleString("es-BO");

    const textoSolicitud = [
        "SOLICITUD DE DONACIONES - CASA AMANDITA",
        "",
        "Artículos necesarios para cubrir el stock mínimo:",
        "",
        ...prioridades.map((articulo, indice) =>
            `${indice + 1}. ${articulo.nombre}: ` +
            `${formatear(articulo.faltante)} ` +
            `${articulo.unidad_medida || "unidades"}`
        ),
        "",
        "Agradecemos cualquier colaboración.",
    ].join("\n");

    const copiarSolicitud = async () => {
        try {
            await navigator.clipboard.writeText(textoSolicitud);
            setMensaje("Solicitud copiada correctamente.");
        } catch {
            setMensaje(
                "No se pudo copiar automáticamente. Selecciona el texto."
            );
        }
    };

    return (
        <section className="inv-pagina necesidades-pagina">
            <div className="inv-contenedor">
                <button
                    type="button"
                    className="inv-volver"
                    onClick={() => navegar("almacen")}
                >
                    ← Volver al almacén
                </button>

                <div className="necesidades-encabezado">
                    <div>
                        <span className="inv-etiqueta">
                            ✦ CASA AMANDITA · ADMINISTRACIÓN
                        </span>

                        <h1 className="inv-titulo">
                            Necesidades <em>críticas.</em>
                        </h1>

                        <p className="inv-descripcion">
                            Identifica los recursos prioritarios
                            y organiza solicitudes de donación
                            según las necesidades del inventario.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="inv-boton"
                        onClick={cargarReporte}
                        disabled={cargando}
                    >
                        ↻ Actualizar reporte
                    </button>
                </div>

                {error && (
                    <div className="inv-mensaje error" role="alert">
                        ✕ {error}
                    </div>
                )}

                <div className="necesidades-resumen">
                    <div className="necesidades-resumen-card">
                        <span>Artículos con faltantes</span>
                        <strong>{prioridades.length}</strong>
                        <small>Debajo del stock mínimo</small>
                    </div>

                    <div className="necesidades-resumen-card urgente">
                        <span>Necesidad crítica</span>
                        <strong>{criticos}</strong>
                        <small>{agotados} sin existencias</small>
                    </div>

                    <div className="necesidades-resumen-card">
                        <span>Stock saludable</span>
                        <strong>{saludables}</strong>
                        <small>Al menos el mínimo requerido</small>
                    </div>
                </div>

                {sinMinimo > 0 && (
                    <div className="necesidades-aviso">
                        <span>ⓘ</span>
                        <p>
                            Hay {sinMinimo} artículo(s) sin stock
                            mínimo configurado. No se consideran
                            en el cálculo de necesidades críticas.
                        </p>
                    </div>
                )}

                <div className="inv-tarjeta necesidades-grafico">
                    <div className="necesidades-seccion-titulo">
                        <div>
                            <span className="inv-etiqueta">
                                ✦ ANÁLISIS DE INVENTARIO
                            </span>

                            <h2>Artículos de mayor urgencia</h2>

                            <p>
                                Ordenados por porcentaje faltante
                                respecto a su stock mínimo.
                            </p>
                        </div>

                        <select
                            aria-label="Filtrar por urgencia"
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                        >
                            <option value="todos">
                                Todos los faltantes
                            </option>
                            <option value="criticos">
                                Críticos y agotados
                            </option>
                            <option value="bajo">
                                Stock bajo
                            </option>
                        </select>
                    </div>

                    {cargando ? (
                        <div className="inv-vacio">
                            Analizando el inventario...
                        </div>
                    ) : visibles.length === 0 ? (
                        <div className="necesidades-vacio">
                            <span>♡</span>
                            <h3>No hay faltantes en esta categoría</h3>
                            <p>
                                Los artículos con mínimos definidos
                                no presentan las necesidades
                                seleccionadas.
                            </p>
                        </div>
                    ) : (
                        <div className="necesidades-barras">
                            {visibles.map((articulo, indice) => (
                                <div
                                    className="necesidades-barra-item"
                                    key={articulo.id}
                                >
                                    <div className="necesidades-barra-superior">
                                        <div>
                                            <span className="necesidades-posicion">
                                                {indice + 1}
                                            </span>
                                            <strong>
                                                {articulo.nombre}
                                            </strong>
                                        </div>

                                        <span className={
                                            `necesidades-estado ${articulo.estado}`
                                        }>
                                            {nombreEstado(articulo.estado)}
                                        </span>
                                    </div>

                                    <div
                                        className="necesidades-barra-fondo"
                                        role="progressbar"
                                        aria-label={
                                            `Porcentaje faltante de ${articulo.nombre}`
                                        }
                                        aria-valuenow={
                                            Math.round(articulo.porcentajeFaltante)
                                        }
                                        aria-valuemin="0"
                                        aria-valuemax="100"
                                    >
                                        <div
                                            className={
                                                `necesidades-barra-relleno ${articulo.estado}`
                                            }
                                            style={{
                                                width:
                                                    `${articulo.porcentajeFaltante}%`,
                                            }}
                                        />
                                    </div>

                                    <div className="necesidades-barra-detalle">
                                        <span>
                                            Disponible:{" "}
                                            <strong>
                                                {formatear(articulo.actual)}
                                            </strong>
                                        </span>

                                        <span>
                                            Mínimo:{" "}
                                            <strong>
                                                {formatear(articulo.minimo)}
                                            </strong>
                                        </span>

                                        <span className="necesidades-faltante">
                                            Faltan{" "}
                                            {formatear(articulo.faltante)}
                                            {" "}
                                            {articulo.unidad_medida || "unidades"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="necesidades-nota">
                        La longitud de cada barra representa qué
                        porcentaje del mínimo todavía falta cubrir,
                        no la cantidad absoluta de unidades.
                    </p>
                </div>

                <div className="inv-tarjeta necesidades-solicitud">
                    <div className="necesidades-seccion-titulo">
                        <div>
                            <span className="inv-etiqueta">
                                ✦ SOLICITUD DE DONACIONES
                            </span>

                            <h2>¿Qué necesitamos recibir?</h2>

                            <p>
                                Lista preparada con las cantidades
                                faltantes de cada artículo.
                            </p>
                        </div>
                    </div>

                    {prioridades.length === 0 ? (
                        <p className="necesidades-sin-solicitud">
                            No existen faltantes registrados
                            que requieran una solicitud.
                        </p>
                    ) : (
                        <>
                            <textarea
                                className="necesidades-texto-solicitud"
                                readOnly
                                aria-label="Texto de solicitud de donaciones"
                                value={textoSolicitud}
                            />

                            <div className="necesidades-solicitud-pie">
                                <p>
                                    Puedes copiar esta lista para
                                    preparar una solicitud de donaciones.
                                </p>

                                <button
                                    type="button"
                                    className="inv-boton"
                                    onClick={copiarSolicitud}
                                >
                                    Copiar solicitud
                                </button>
                            </div>

                            {mensaje && (
                                <div
                                    className="inv-mensaje exito"
                                    role="status"
                                >
                                    {mensaje}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

export default NecesidadesCriticas;
