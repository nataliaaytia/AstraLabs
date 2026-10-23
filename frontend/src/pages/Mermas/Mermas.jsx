
import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import "../InventarioComun.css";
import "./Mermas.css";

const MOTIVOS = [
    { valor: "vencimiento", nombre: "Vencimiento" },
    { valor: "deterioro", nombre: "Deterioro" },
    { valor: "perdida", nombre: "Pérdida" },
];

function Mermas({ navegar, usuarioActual }) {
    const [articulos, setArticulos] = useState([]);
    const [formulario, setFormulario] = useState({
        articuloId: "",
        cantidad: "",
        motivo: "",
    });
    const [mensaje, setMensaje] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        inventarioApi.listarArticulos()
            .then((datos) => {
                if (!Array.isArray(datos)) {
                    throw new Error("El catálogo no está disponible.");
                }
                setArticulos(datos);
            })
            .catch((err) =>
                setMensaje({ tipo: "error", texto: err.message })
            )
            .finally(() => setCargando(false));
    }, []);

    const cambiarCampo = (e) => {
        setFormulario((anterior) => ({
            ...anterior,
            [e.target.name]: e.target.value,
        }));
        setMensaje(null);
    };

    const guardarMerma = async (e) => {
        e.preventDefault();

        const articuloId = Number(formulario.articuloId);
        const cantidad = Number(formulario.cantidad);

        if (!Number.isInteger(articuloId) || articuloId <= 0) {
            setMensaje({ tipo: "error", texto: "Selecciona un artículo." });
            return;
        }

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            setMensaje({
                tipo: "error",
                texto: "La cantidad debe ser mayor a cero.",
            });
            return;
        }

        if (!MOTIVOS.some((m) => m.valor === formulario.motivo)) {
            setMensaje({
                tipo: "error",
                texto: "Selecciona un motivo válido.",
            });
            return;
        }

        if (!usuarioActual?.id || !Number.isInteger(Number(usuarioActual.id))) {
            setMensaje({
                tipo: "error",
                texto: "Necesitas una sesión válida del backend.",
            });
            return;
        }

        setGuardando(true);
        setMensaje(null);

        try {
            await inventarioApi.registrarMerma({
                articuloId,
                cantidad,
                usuarioId: Number(usuarioActual.id),
                motivo: formulario.motivo,
            });

            setFormulario({
                articuloId: "",
                cantidad: "",
                motivo: "",
            });

            setMensaje({
                tipo: "exito",
                texto: "La merma fue registrada correctamente.",
            });
        } catch (err) {
            setMensaje({
                tipo: "error",
                texto: err.message,
            });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <section className="inv-pagina mermas-pagina">
            <div className="inv-contenedor">
                <button
                    className="inv-volver"
                    onClick={() => navegar("almacen")}
                >
                    ← Volver al almacén
                </button>

                <span className="inv-etiqueta">
                    ✦ CASA AMANDITA · MOVIMIENTOS
                </span>

                <h1 className="inv-titulo">
                    Registrar <em>merma.</em>
                </h1>

                <p className="inv-descripcion">
                    Registra las pérdidas de artículos por vencimiento,
                    deterioro u otras situaciones contempladas.
                </p>

                <div className="inv-tarjeta">
                    <h2>Datos de la merma</h2>

                    {mensaje && (
                        <div className={`inv-mensaje ${mensaje.tipo}`} role="status">
                            {mensaje.tipo === "exito" ? "✓" : "✕"} {mensaje.texto}
                        </div>
                    )}

                    <form className="inv-formulario" onSubmit={guardarMerma}>
                        <div className="inv-campo">
                            <label htmlFor="merma-articulo">Artículo *</label>
                            <select
                                id="merma-articulo"
                                name="articuloId"
                                value={formulario.articuloId}
                                onChange={cambiarCampo}
                                required
                            >
                                <option value="">Seleccionar artículo</option>
                                {articulos.map((articulo) => (
                                    <option key={articulo.id} value={articulo.id}>
                                        {articulo.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="inv-campo">
                            <label htmlFor="merma-cantidad">Cantidad *</label>
                            <input
                                id="merma-cantidad"
                                type="number"
                                name="cantidad"
                                min="0.01"
                                step="any"
                                value={formulario.cantidad}
                                onChange={cambiarCampo}
                                placeholder="Ej. 3"
                                required
                            />
                        </div>

                        <div className="inv-campo inv-ancho">
                            <label htmlFor="merma-motivo">Motivo de la pérdida *</label>
                            <select
                                id="merma-motivo"
                                name="motivo"
                                value={formulario.motivo}
                                onChange={cambiarCampo}
                                required
                            >
                                <option value="">Seleccionar motivo</option>
                                {MOTIVOS.map((motivo) => (
                                    <option key={motivo.valor} value={motivo.valor}>
                                        {motivo.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mermas-aviso inv-ancho">
                            <span aria-hidden="true">♡</span>
                            <p>
                                Este registro dejará constancia de la pérdida
                                y descontará las existencias cuando el backend
                                confirme la operación.
                            </p>
                        </div>

                        <div className="inv-acciones">
                            <button
                                type="button"
                                className="mermas-cancelar"
                                onClick={() => navegar("almacen")}
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                className="inv-boton"
                                disabled={guardando || cargando || articulos.length === 0}
                            >
                                {guardando ? "Guardando..." : "Registrar merma →"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    );
}

export default Mermas;
