
import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import "../InventarioComun.css";
import "./Salidas.css";

function Salidas({ navegar, usuarioActual }) {
    const [articulos, setArticulos] = useState([]);
    const [formulario, setFormulario] = useState({
        articuloId: "",
        cantidad: "",
        destino: "",
    });
    const [stockDisponible, setStockDisponible] = useState(null);
    const [mensaje, setMensaje] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);

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
        const { name, value } = e.target;

        setFormulario((anterior) => ({
            ...anterior,
            [name]: value,
        }));

        setMensaje(null);

        if (name === "articuloId") {
            setStockDisponible(null);

            if (value) {
                inventarioApi.consultarStock(value)
                    .then((datos) => setStockDisponible(datos))
                    .catch(() => setStockDisponible(null));
            }
        }
    };

    const guardarSalida = async (e) => {
        e.preventDefault();

        const cantidad = Number(formulario.cantidad);
        const articuloId = Number(formulario.articuloId);

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

        if (!formulario.destino.trim()) {
            setMensaje({
                tipo: "error",
                texto: "Debes indicar un destino.",
            });
            return;
        }

        if (
            stockDisponible &&
            cantidad > Number(stockDisponible.stock_actual)
        ) {
            setMensaje({
                tipo: "error",
                texto: "La cantidad supera el stock disponible.",
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
            await inventarioApi.registrarSalida({
                articuloId,
                cantidad,
                usuarioId: Number(usuarioActual.id),
                destino: formulario.destino.trim(),
            });

            setFormulario({
                articuloId: "",
                cantidad: "",
                destino: "",
            });
            setStockDisponible(null);

            setMensaje({
                tipo: "exito",
                texto: "La salida se registró correctamente.",
            });
        } catch (err) {
            setMensaje({ tipo: "error", texto: err.message });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <section className="inv-pagina salidas-pagina">
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
                    Registrar <em>salida.</em>
                </h1>

                <p className="inv-descripcion">
                    Registra los artículos que se utilizan o entregan,
                    indicando la cantidad y su destino.
                </p>

                <div className="inv-tarjeta">
                    <h2>Datos de la salida</h2>

                    {mensaje && (
                        <div className={`inv-mensaje ${mensaje.tipo}`} role="status">
                            {mensaje.tipo === "exito" ? "✓" : "✕"} {mensaje.texto}
                        </div>
                    )}

                    <form className="inv-formulario" onSubmit={guardarSalida}>
                        <div className="inv-campo">
                            <label htmlFor="salida-articulo">Artículo *</label>
                            <select
                                id="salida-articulo"
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
                            <label htmlFor="salida-cantidad">Cantidad *</label>
                            <input
                                id="salida-cantidad"
                                name="cantidad"
                                type="number"
                                min="0.01"
                                step="any"
                                value={formulario.cantidad}
                                onChange={cambiarCampo}
                                placeholder="Ej. 5"
                                required
                            />
                        </div>

                        {stockDisponible && (
                            <div className="salidas-disponibilidad inv-ancho">
                                <span>Existencias disponibles</span>
                                <strong>{stockDisponible.stock_actual}</strong>
                            </div>
                        )}

                        <div className="inv-campo inv-ancho">
                            <label htmlFor="salida-destino">Destino *</label>
                            <input
                                id="salida-destino"
                                name="destino"
                                value={formulario.destino}
                                onChange={cambiarCampo}
                                placeholder="Ej. Cocina - desayuno"
                                maxLength={150}
                                required
                            />
                        </div>

                        <div className="inv-acciones">
                            <button
                                type="button"
                                className="salidas-cancelar"
                                onClick={() => navegar("almacen")}
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                className="inv-boton"
                                disabled={guardando || cargando || articulos.length === 0}
                            >
                                {guardando ? "Guardando..." : "Registrar salida →"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    );
}

export default Salidas;
