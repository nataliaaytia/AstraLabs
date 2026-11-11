
import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import { asignarLote, obtenerLotes } from "../../data/lotes";
import "../InventarioComun.css";
import "./Lotes.css";

const FORMULARIO_INICIAL = {
    articuloId: "",
    codigo: "",
    cantidad: "",
    fechaVencimiento: "",
};

function Lotes({ navegar }) {
    const [articulos, setArticulos] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [formulario, setFormulario] = useState({
        ...FORMULARIO_INICIAL,
    });
    const [mensaje, setMensaje] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [filtro, setFiltro] = useState("");

    const cargarDatos = async () => {
        const lista = await inventarioApi.listarArticulos();

        setArticulos(lista);
        setLotes(obtenerLotes(lista));
    };

    useEffect(() => {
        cargarDatos()
            .catch((error) => {
                setMensaje({
                    tipo: "error",
                    texto: error.message,
                });
            })
            .finally(() => setCargando(false));
    }, []);

    const cambiarCampo = (evento) => {
        setFormulario((anterior) => ({
            ...anterior,
            [evento.target.name]: evento.target.value,
        }));

        setMensaje(null);
    };

    const registrar = async (evento) => {
        evento.preventDefault();

        try {
            const nuevo = asignarLote(formulario, articulos);

            await cargarDatos();

            setFormulario({ ...FORMULARIO_INICIAL });

            setMensaje({
                tipo: "exito",
                texto:
                    `Lote ${nuevo.codigo} registrado correctamente. ` +
                    "El stock total se mantiene igual.",
            });
        } catch (error) {
            setMensaje({
                tipo: "error",
                texto: error.message,
            });
        }
    };

    const articuloSeleccionado = articulos.find(
        (a) => String(a.id) === String(formulario.articuloId)
    );

    const sinAsignar = lotes
        .filter(
            (l) =>
                String(l.articuloId) === String(formulario.articuloId) &&
                l.codigo === "SIN-ASIGNAR"
        )
        .reduce(
            (suma, l) => suma + Number(l.cantidadDisponible),
            0
        );

    const hoy = new Date();
    const fechaHoy = [
        hoy.getFullYear(),
        String(hoy.getMonth() + 1).padStart(2, "0"),
        String(hoy.getDate()).padStart(2, "0"),
    ].join("-");

    const diasParaVencer = (fecha) => {
        if (!fecha) return null;

        const [anio, mes, dia] = fecha.split("-").map(Number);
        const [a, m, d] = fechaHoy.split("-").map(Number);

        return Math.round(
            (
                Date.UTC(anio, mes - 1, dia) -
                Date.UTC(a, m - 1, d)
            ) / 86400000
        );
    };

    const visibles = lotes
        .filter(
            (l) =>
                Number(l.cantidadDisponible) > 0 &&
                (!filtro || String(l.articuloId) === filtro)
        )
        .sort((a, b) => {
            if (!a.fechaVencimiento) return 1;
            if (!b.fechaVencimiento) return -1;

            return a.fechaVencimiento.localeCompare(
                b.fechaVencimiento
            );
        });

    const obtenerNombre = (id) =>
        articulos.find((a) => String(a.id) === String(id));

    return (
        <section className="inv-pagina lotes-pagina">
            <div className="inv-contenedor">
                <button
                    type="button"
                    className="inv-volver"
                    onClick={() => navegar("almacen")}
                >
                    ← Volver al almacén
                </button>

                <span className="inv-etiqueta">
                    ✦ CASA AMANDITA · CONTROL FEFO
                </span>

                <h1 className="inv-titulo">
                    Control de <em>vencimientos.</em>
                </h1>

                <p className="inv-descripcion">
                    Organiza las existencias en lotes para priorizar
                    los ingredientes próximos a vencer y reducir
                    las pérdidas de alimentos.
                </p>

                <div className="lotes-resumen">
                    <div>
                        <span>Lotes disponibles</span>
                        <strong>{visibles.length}</strong>
                        <small>Con existencias</small>
                    </div>

                    <div>
                        <span>Próximos a vencer</span>
                        <strong>
                            {visibles.filter((l) => {
                                const dias = diasParaVencer(
                                    l.fechaVencimiento
                                );
                                return dias !== null &&
                                    dias >= 0 && dias <= 7;
                            }).length}
                        </strong>
                        <small>En los próximos 7 días</small>
                    </div>
                </div>

                {mensaje && (
                    <div
                        className={`inv-mensaje ${mensaje.tipo}`}
                        role="status"
                    >
                        {mensaje.tipo === "exito" ? "✓" : "✕"}
                        {" "}
                        {mensaje.texto}
                    </div>
                )}

                <div className="lotes-distribucion">
                    <div className="inv-tarjeta">
                        <h2>Asignar vencimiento</h2>

                        <p className="lotes-ayuda">
                            Distribuye el stock existente en lotes.
                            Este registro no aumenta las existencias.
                        </p>

                        <form
                            className="inv-formulario"
                            onSubmit={registrar}
                        >
                            <div className="inv-campo inv-ancho">
                                <label htmlFor="lote-articulo">
                                    Artículo *
                                </label>

                                <select
                                    id="lote-articulo"
                                    name="articuloId"
                                    value={formulario.articuloId}
                                    onChange={cambiarCampo}
                                    required
                                >
                                    <option value="">
                                        Seleccionar artículo
                                    </option>

                                    {articulos.map((a) => (
                                        <option
                                            key={a.id}
                                            value={a.id}
                                        >
                                            {a.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {articuloSeleccionado && (
                                <div className="lotes-stock inv-ancho">
                                    <span>Stock sin asignar</span>

                                    <strong>
                                        {Number(sinAsignar.toFixed(3))}
                                        {" "}
                                        {articuloSeleccionado.unidad_medida}
                                    </strong>
                                </div>
                            )}

                            <div className="inv-campo inv-ancho">
                                <label htmlFor="lote-codigo">
                                    Código del lote *
                                </label>

                                <input
                                    id="lote-codigo"
                                    name="codigo"
                                    value={formulario.codigo}
                                    onChange={cambiarCampo}
                                    placeholder="Ej. ARZ-001"
                                    maxLength={30}
                                    required
                                />
                            </div>

                            <div className="inv-campo">
                                <label htmlFor="lote-cantidad">
                                    Cantidad *
                                </label>

                                <input
                                    id="lote-cantidad"
                                    name="cantidad"
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    value={formulario.cantidad}
                                    onChange={cambiarCampo}
                                    required
                                />
                            </div>

                            <div className="inv-campo">
                                <label htmlFor="lote-vencimiento">
                                    Vencimiento *
                                </label>

                                <input
                                    id="lote-vencimiento"
                                    name="fechaVencimiento"
                                    type="date"
                                    min={fechaHoy}
                                    value={formulario.fechaVencimiento}
                                    onChange={cambiarCampo}
                                    required
                                />
                            </div>

                            <div className="inv-acciones">
                                <button
                                    type="submit"
                                    className="inv-boton"
                                    disabled={cargando || articulos.length === 0}
                                >
                                    Guardar lote →
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="lotes-directorio">
                        <div className="lotes-directorio-encabezado">
                            <span>✦ INVENTARIO POR LOTES</span>
                            <h2>Prioridad de consumo</h2>

                            <select
                                value={filtro}
                                onChange={(e) => setFiltro(e.target.value)}
                                aria-label="Filtrar por artículo"
                            >
                                <option value="">
                                    Todos los artículos
                                </option>

                                {articulos.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {visibles.length === 0 ? (
                            <div className="inv-vacio">
                                No hay lotes con existencias.
                            </div>
                        ) : (
                            <div className="lotes-lista">
                                {visibles.map((lote) => {
                                    const articulo = obtenerNombre(
                                        lote.articuloId
                                    );

                                    const dias = diasParaVencer(
                                        lote.fechaVencimiento
                                    );

                                    const estado = dias === null
                                        ? "sin-fecha"
                                        : dias < 0
                                            ? "vencido"
                                            : dias <= 7
                                                ? "proximo"
                                                : "vigente";

                                    return (
                                        <article
                                            className="lotes-registro"
                                            key={lote.id}
                                        >
                                            <div className="lotes-registro-superior">
                                                <strong>
                                                    {articulo?.nombre ||
                                                        "Artículo"}
                                                </strong>

                                                <span className={
                                                    `lotes-etiqueta ${estado}`
                                                }>
                                                    {estado === "sin-fecha"
                                                        ? "Sin fecha"
                                                        : estado === "vencido"
                                                            ? "Vencido"
                                                            : estado === "proximo"
                                                                ? "Próximo a vencer"
                                                                : "Vigente"}
                                                </span>
                                            </div>

                                            <p>Lote: {lote.codigo}</p>

                                            <div className="lotes-registro-datos">
                                                <span>
                                                    {lote.fechaVencimiento ||
                                                        "Vencimiento no asignado"}
                                                </span>

                                                <strong>
                                                    {lote.cantidadDisponible}
                                                    {" "}
                                                    {articulo?.unidad_medida || ""}
                                                </strong>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default Lotes;
