import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import {
    ESTADOS_PENDIENTES,
    calcularInsumos,
    resumirPlanes,
    stockUtilizable,
} from "../../data/insumos";
import "../InventarioComun.css";
import "./InsumosFaltantes.css";

const NOMBRES_ESTADO = {
    suficiente: "Suficiente",
    "bajo-minimo": "Quedará bajo el mínimo",
    falta: "Falta",
    "sin-stock": "Sin stock",
    inexistente: "No existe",
};

const PASOS = [
    {
        icono: "♧",
        titulo: "Elige un plan",
        texto: "Selecciona un plan pendiente o revisa todos juntos.",
    },
    {
        icono: "✧",
        titulo: "Comparamos",
        texto: "Lo que pide la receta contra lo disponible, sin contar lo vencido.",
    },
    {
        icono: "✿",
        titulo: "Repones",
        texto: "Lo que falta para cocinar y lo que quedaría bajo el mínimo.",
    },
];

function InsumosFaltantes({ navegar }) {
    const [planes, setPlanes] = useState([]);
    const [inventario, setInventario] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [seleccion, setSeleccion] = useState("todos");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [copiado, setCopiado] = useState("");

    useEffect(() => {
        let activo = true;

        Promise.all([
            inventarioApi.listarPlanesComida(),
            inventarioApi.listarArticulos(),
            inventarioApi.listarLotes(),
        ])
            .then(([listaPlanes, listaArticulos, listaLotes]) => {
                if (!activo) return;

                setPlanes(
                    listaPlanes
                        .filter((p) => ESTADOS_PENDIENTES.includes(p.estado))
                        .sort((a, b) => a.fecha.localeCompare(b.fecha))
                );
                setInventario(listaArticulos);
                setLotes(listaLotes);
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

    const stock = stockUtilizable(lotes);
    const resumenPlanes = resumirPlanes(planes, inventario, stock);

    const planesElegidos = seleccion === "todos"
        ? planes
        : planes.filter((p) => String(p.id) === seleccion);

    const insumos = calcularInsumos(planesElegidos, inventario, stock);
    const faltantes = insumos.filter((i) => i.faltante > 0);
    const bajoMinimo = insumos.filter((i) => i.estado === "bajo-minimo");
    const porReponer = insumos.filter((i) => i.reponer > 0);
    const conVencidos = insumos.filter((i) => i.vencido > 0);

    const formatear = (numero) =>
        Number(Number(numero).toFixed(3)).toLocaleString("es-BO");

    const elegir = (valor) => {
        setSeleccion(valor);
        setCopiado("");
    };

    const planActual = planesElegidos[0];

    const textoReposicion = [
        "LISTA DE REPOSICIÓN - CASA AMANDITA",
        "",
        seleccion === "todos"
            ? `Para ${planesElegidos.length} plan(es) pendiente(s):`
            : `Para: ${planActual?.nombre || ""} (${planActual?.fecha || ""})`,
        "",
        ...porReponer.map((insumo, indice) =>
            `${indice + 1}. ${insumo.nombre}: ` +
            `${formatear(insumo.reponer)} ${insumo.unidad}` +
            (insumo.faltante > 0
                ? ` (faltan ${formatear(insumo.faltante)} para cocinar)`
                : " (para mantener el mínimo)")
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
                    necesario para cada plan de comida y qué conviene
                    reponer para no quedarnos cortos.
                </p>

                <div className="insumos-pasos">
                    {PASOS.map((paso, indice) => (
                        <div key={paso.titulo}>
                            <span className="insumos-paso-icono">{paso.icono}</span>
                            <div>
                                <strong>{indice + 1}. {paso.titulo}</strong>
                                <p>{paso.texto}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="inv-mensaje error" role="alert">
                        ✕ {error}
                    </div>
                )}

                <div className="inv-tarjeta insumos-planes-tarjeta">
                    <div className="insumos-seccion-titulo">
                        <h2>Planes pendientes</h2>
                        <span>{planes.length} por cocinar</span>
                    </div>

                    {cargando ? (
                        <div className="inv-vacio">Revisando los planes...</div>
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
                    ) : (
                        <div className="insumos-planes">
                            <button
                                type="button"
                                className={`insumos-plan todos ${seleccion === "todos" ? "activo" : ""}`}
                                onClick={() => elegir("todos")}
                                aria-pressed={seleccion === "todos"}
                            >
                                <span className="insumos-plan-tipo">Resumen</span>
                                <strong>Todos los planes</strong>
                                <small>
                                    {resumenPlanes.filter((p) => p.listo).length} de{" "}
                                    {resumenPlanes.length} listos para cocinar
                                </small>
                            </button>

                            {resumenPlanes.map((plan) => (
                                <button
                                    type="button"
                                    key={plan.id}
                                    className={`insumos-plan ${seleccion === String(plan.id) ? "activo" : ""}`}
                                    onClick={() => elegir(String(plan.id))}
                                    aria-pressed={seleccion === String(plan.id)}
                                >
                                    <span className="insumos-plan-tipo">
                                        {plan.tipoComida} · {plan.fecha}
                                    </span>

                                    <strong>{plan.nombre}</strong>

                                    <small>
                                        {plan.porciones
                                            ? `${plan.porciones} porciones · `
                                            : ""}
                                        {plan.totalInsumos} ingrediente(s) ·{" "}
                                        {plan.estado === "borrador" ? "Borrador" : "Confirmado"}
                                    </small>

                                    <span className={`insumos-plan-estado ${plan.listo ? "listo" : "incompleto"}`}>
                                        {plan.listo
                                            ? "✓ Listo para cocinar"
                                            : `Faltan ${plan.faltantes} insumo(s)`}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {planes.length > 0 && (
                    <div className="insumos-resumen">
                        <div>
                            <strong>{insumos.length}</strong>
                            <span>Insumos revisados</span>
                        </div>

                        <div className={faltantes.length > 0 ? "alerta" : ""}>
                            <strong>{faltantes.length}</strong>
                            <span>No alcanzan</span>
                        </div>

                        <div className={bajoMinimo.length > 0 ? "aviso" : ""}>
                            <strong>{bajoMinimo.length}</strong>
                            <span>Quedarán bajo el mínimo</span>
                        </div>

                        <div>
                            <strong>
                                {insumos.length - faltantes.length - bajoMinimo.length}
                            </strong>
                            <span>Sin problema</span>
                        </div>
                    </div>
                )}

                {conVencidos.length > 0 && (
                    <div className="insumos-aviso">
                        <span>◷</span>
                        <p>
                            {conVencidos.map((i) =>
                                `${i.nombre} (${formatear(i.vencido)} ${i.unidad})`
                            ).join(", ")}
                            {" "}tiene(n) existencias vencidas que no se
                            cuentan como disponibles.
                        </p>
                    </div>
                )}

                {planes.length > 0 && (
                    <div className="inv-tarjeta">
                        <div className="insumos-seccion-titulo">
                            <h2>
                                {seleccion === "todos"
                                    ? "¿Qué necesitamos en total?"
                                    : `¿Qué necesita "${planActual?.nombre}"?`}
                            </h2>
                        </div>

                        {insumos.length === 0 ? (
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
                                            <div>
                                                <strong>{insumo.nombre}</strong>
                                                {insumo.categoria && (
                                                    <small>{insumo.categoria}</small>
                                                )}
                                            </div>

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

                                        <div className="insumos-datos">
                                            <div>
                                                <span>Necesario</span>
                                                <strong>
                                                    {formatear(insumo.necesario)} {insumo.unidad}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Disponible</span>
                                                <strong>
                                                    {formatear(insumo.disponible)} {insumo.unidad}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Quedará</span>
                                                <strong>
                                                    {formatear(insumo.restante)} {insumo.unidad}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Stock mínimo</span>
                                                <strong>
                                                    {insumo.minimo
                                                        ? `${formatear(insumo.minimo)} ${insumo.unidad}`
                                                        : "Sin definir"}
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="insumos-pie">
                                            <span>Se usa en: {insumo.usadoEn.join(", ")}</span>

                                            {insumo.faltante > 0 ? (
                                                <span className="insumos-faltante">
                                                    Faltan {formatear(insumo.faltante)} {insumo.unidad} para cocinar
                                                </span>
                                            ) : insumo.reponer > 0 ? (
                                                <span className="insumos-sugerencia">
                                                    Reponer {formatear(insumo.reponer)} {insumo.unidad} para mantener el mínimo
                                                </span>
                                            ) : null}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {porReponer.length > 0 && (
                    <div className="inv-tarjeta insumos-reposicion">
                        <span className="inv-etiqueta">
                            ✦ LISTA DE REPOSICIÓN
                        </span>

                        <h2>Antes de cocinar, reponer:</h2>

                        <p className="insumos-reposicion-ayuda">
                            La cantidad sugerida cubre lo que pide el plan
                            y deja el artículo en su stock mínimo.
                        </p>

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
