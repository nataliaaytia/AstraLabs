import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import { ESTADOS_PENDIENTES, calcularInsumos } from "../../data/insumos";
import "../InventarioComun.css";
import "./InsumosFaltantes.css";

const NOMBRES_ESTADO = {
    suficiente: "Suficiente",
    falta: "Falta",
    "sin-stock": "Sin stock",
    inexistente: "No existe",
};

function InsumosFaltantes({ navegar }) {
    const [planes, setPlanes] = useState([]);
    const [inventario, setInventario] = useState([]);
    const [seleccion, setSeleccion] = useState("todos");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [copiado, setCopiado] = useState("");

    useEffect(() => {
        let activo = true;

        Promise.all([
            inventarioApi.listarPlanesComida(),
            inventarioApi.listarArticulos(),
        ])
            .then(([listaPlanes, listaArticulos]) => {
                if (!activo) return;

                setPlanes(
                    listaPlanes
                        .filter((p) => ESTADOS_PENDIENTES.includes(p.estado))
                        .sort((a, b) => a.fecha.localeCompare(b.fecha))
                );
                setInventario(listaArticulos);
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

    const planesElegidos = seleccion === "todos"
        ? planes
        : planes.filter((p) => String(p.id) === seleccion);

    const insumos = calcularInsumos(planesElegidos, inventario);
    const faltantes = insumos.filter((i) => i.faltante > 0);
    const conVencidos = insumos.filter((i) => i.vencido > 0);

    const formatear = (numero) =>
        Number(Number(numero).toFixed(3)).toLocaleString("es-BO");

    const textoReposicion = [
        "LISTA DE REPOSICIÓN - CASA AMANDITA",
        "",
        seleccion === "todos"
            ? `Para ${planesElegidos.length} plan(es) pendiente(s):`
            : `Para: ${planesElegidos[0]?.nombre || ""} (${planesElegidos[0]?.fecha || ""})`,
        "",
        ...faltantes.map((insumo, indice) =>
            `${indice + 1}. ${insumo.nombre}: ` +
            `${formatear(insumo.faltante)} ${insumo.unidad}`
        ),
    ].join("\n");

    const copiarLista = async () => {
        try {
            await navigator.clipboard.writeText(textoReposicion);
            setCopiado("Lista de reposición copiada.");
        } catch {
            setCopiado("No se pudo copiar automáticamente. Selecciona el texto.");
        }
    };

    return (
        <section className="inv-pagina insumos-pagina">
            <div className="inv-contenedor">
                <button
                    type="button"
                    className="inv-volver"
                    onClick={() => navegar("almacen")}
                >
                    ← Volver al almacén
                </button>

                <span className="inv-etiqueta">
                    ✦ CASA AMANDITA · COCINA
                </span>

                <h1 className="inv-titulo">
                    Insumos <em>faltantes.</em>
                </h1>

                <p className="inv-descripcion">
                    Antes de cocinar, revisemos si tenemos todo lo
                    necesario. Solo contamos el stock que no está
                    vencido.
                </p>

                {error && (
                    <div className="inv-mensaje error" role="alert">
                        ✕ {error}
                    </div>
                )}

                <div className="insumos-selector inv-tarjeta">
                    <div className="inv-campo">
                        <label htmlFor="insumos-plan">
                            Plan de comida a revisar
                        </label>

                        <select
                            id="insumos-plan"
                            value={seleccion}
                            onChange={(e) => {
                                setSeleccion(e.target.value);
                                setCopiado("");
                            }}
                            disabled={cargando || planes.length === 0}
                        >
                            <option value="todos">
                                Todos los planes pendientes ({planes.length})
                            </option>

                            {planes.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                    {plan.fecha} · {plan.tipoComida} · {plan.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="insumos-resumen">
                        <div>
                            <strong>{planesElegidos.length}</strong>
                            <span>Plan(es)</span>
                        </div>

                        <div className={faltantes.length > 0 ? "alerta" : ""}>
                            <strong>{faltantes.length}</strong>
                            <span>Insumos faltantes</span>
                        </div>

                        <div>
                            <strong>{insumos.length - faltantes.length}</strong>
                            <span>Insumos completos</span>
                        </div>
                    </div>
                </div>

                {conVencidos.length > 0 && (
                    <div className="insumos-aviso">
                        <span>◷</span>
                        <p>
                            {conVencidos.length} insumo(s) tienen
                            existencias vencidas que no se pueden
                            usar en la preparación.
                        </p>
                    </div>
                )}

                <div className="inv-tarjeta">
                    <h2>¿Qué necesitamos?</h2>

                    {cargando ? (
                        <div className="inv-vacio">
                            Revisando los planes...
                        </div>
                    ) : planes.length === 0 ? (
                        <div className="insumos-vacio">
                            <span>♧</span>
                            <h3>No hay planes pendientes</h3>
                            <p>
                                Crea un plan de comida para revisar
                                sus insumos.
                            </p>

                            <button
                                type="button"
                                className="inv-boton"
                                onClick={() => navegar("planificadorComidas")}
                            >
                                Ir al planificador →
                            </button>
                        </div>
                    ) : insumos.length === 0 ? (
                        <div className="inv-vacio">
                            El plan seleccionado no tiene ingredientes.
                        </div>
                    ) : (
                        <div className="insumos-lista">
                            {insumos.map((insumo) => (
                                <article
                                    key={insumo.articuloId}
                                    className={`insumos-item ${insumo.estado}`}
                                >
                                    <div className="insumos-item-superior">
                                        <strong>{insumo.nombre}</strong>

                                        <span className={`insumos-estado ${insumo.estado}`}>
                                            {NOMBRES_ESTADO[insumo.estado]}
                                        </span>
                                    </div>

                                    <div
                                        className="insumos-barra"
                                        role="progressbar"
                                        aria-label={`Disponibilidad de ${insumo.nombre}`}
                                        aria-valuenow={insumo.porcentaje}
                                        aria-valuemin="0"
                                        aria-valuemax="100"
                                    >
                                        <div style={{ width: `${insumo.porcentaje}%` }} />
                                    </div>

                                    <div className="insumos-detalle">
                                        <span>
                                            Necesario:{" "}
                                            <strong>
                                                {formatear(insumo.necesario)} {insumo.unidad}
                                            </strong>
                                        </span>

                                        <span>
                                            Disponible:{" "}
                                            <strong>
                                                {formatear(insumo.disponible)} {insumo.unidad}
                                            </strong>
                                        </span>

                                        {insumo.faltante > 0 && (
                                            <span className="insumos-faltante">
                                                Faltan {formatear(insumo.faltante)} {insumo.unidad}
                                            </span>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>

                {faltantes.length > 0 && (
                    <div className="inv-tarjeta insumos-reposicion">
                        <span className="inv-etiqueta">
                            ✦ LISTA DE REPOSICIÓN
                        </span>

                        <h2>Antes de cocinar, reponer:</h2>

                        <textarea
                            readOnly
                            value={textoReposicion}
                            aria-label="Lista de reposición"
                        />

                        <div className="insumos-reposicion-pie">
                            <p>
                                Comparte esta lista para conseguir
                                los insumos a tiempo.
                            </p>

                            <button
                                type="button"
                                className="inv-boton"
                                onClick={copiarLista}
                            >
                                Copiar lista
                            </button>
                        </div>

                        {copiado && (
                            <div className="inv-mensaje exito" role="status">
                                ✓ {copiado}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

export default InsumosFaltantes;
