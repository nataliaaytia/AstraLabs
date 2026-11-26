import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import { definirStockMinimo } from "../../data/stockMinimo";
import "../InventarioComun.css";
import "./StockMinimo.css";

function StockMinimo({ navegar }) {
    const [articulos, setArticulos] = useState([]);
    const [cambios, setCambios] = useState({});
    const [busqueda, setBusqueda] = useState("");
    const [mensaje, setMensaje] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        let activo = true;

        inventarioApi.listarArticulos()
            .then((lista) => {
                if (activo) setArticulos(lista);
            })
            .catch((error) => {
                if (activo) {
                    setMensaje({ tipo: "error", texto: error.message });
                }
            })
            .finally(() => {
                if (activo) setCargando(false);
            });

        return () => {
            activo = false;
        };
    }, []);

    const cambiarMinimo = (id, valor) => {
        setCambios((anterior) => ({
            ...anterior,
            [id]: valor,
        }));

        setMensaje(null);
    };

    const descartar = () => {
        setCambios({});
        setMensaje(null);
    };

    const guardar = async () => {
        if (guardando) return;

        setGuardando(true);
        setMensaje(null);

        try {
            const pendientes = Object.fromEntries(
                Object.entries(cambios).filter(([id, valor]) => {
                    const articulo = articulos.find(
                        (a) => String(a.id) === String(id)
                    );

                    return articulo &&
                        Number(valor) !== Number(articulo.stock_minimo);
                })
            );

            const vigentes = await inventarioApi.listarArticulos();
            const total = definirStockMinimo(pendientes, vigentes);
            const lista = await inventarioApi.listarArticulos();

            setArticulos(lista);
            setCambios({});
            setMensaje({
                tipo: "exito",
                texto: `Se actualizó el stock mínimo de ${total} artículo(s).`,
            });
        } catch (error) {
            setMensaje({ tipo: "error", texto: error.message });
        } finally {
            setGuardando(false);
        }
    };

    const valorDe = (articulo) =>
        cambios[articulo.id] ?? String(articulo.stock_minimo ?? 0);

    const estadoDe = (articulo) => {
        const minimo = Number(valorDe(articulo));
        const actual = Number(articulo.stock_actual) || 0;

        if (!minimo) return "sin-minimo";
        if (actual <= minimo) return "bajo";

        return "normal";
    };

    const filtrados = articulos.filter((a) =>
        a.nombre.toLowerCase().includes(busqueda.toLowerCase().trim())
    );

    const editados = Object.entries(cambios).filter(([id, valor]) => {
        const articulo = articulos.find(
            (a) => String(a.id) === String(id)
        );

        return articulo &&
            Number(valor) !== Number(articulo.stock_minimo);
    }).length;

    const sinMinimo = articulos.filter(
        (a) => !Number(a.stock_minimo)
    ).length;

    return (
        <section className="inv-pagina minimo-pagina">
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
                    Stock <em>mínimo.</em>
                </h1>

                <p className="inv-descripcion">
                    Define la cantidad mínima que debemos tener de
                    cada artículo. Cuando las existencias lleguen a
                    ese punto, sabremos que es momento de reponer.
                </p>

                <div className="minimo-resumen">
                    <div>
                        <span>Artículos</span>
                        <strong>{articulos.length}</strong>
                        <small>En el inventario</small>
                    </div>

                    <div>
                        <span>Sin mínimo definido</span>
                        <strong>{sinMinimo}</strong>
                        <small>No generan alertas</small>
                    </div>

                    <div className="minimo-resumen-especial">
                        <span aria-hidden="true">✿</span>
                        <p>
                            Reponer a tiempo,
                            <br />
                            <em>cuidar siempre.</em>
                        </p>
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

                <div className="inv-tarjeta">
                    <div className="minimo-cabecera">
                        <h2>Mínimos por artículo</h2>

                        <input
                            type="search"
                            placeholder="Buscar artículo..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            aria-label="Buscar artículo"
                        />
                    </div>

                    {cargando ? (
                        <div className="inv-vacio">
                            Cargando artículos...
                        </div>
                    ) : filtrados.length === 0 ? (
                        <div className="inv-vacio">
                            No hay artículos para mostrar.
                        </div>
                    ) : (
                        <div className="minimo-tabla-scroll">
                            <table className="minimo-tabla">
                                <thead>
                                    <tr>
                                        <th>Artículo</th>
                                        <th>Categoría</th>
                                        <th>Stock actual</th>
                                        <th>Stock mínimo</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filtrados.map((articulo) => {
                                        const estado = estadoDe(articulo);
                                        const editado =
                                            cambios[articulo.id] !== undefined &&
                                            Number(cambios[articulo.id]) !==
                                            Number(articulo.stock_minimo);

                                        return (
                                            <tr key={articulo.id}>
                                                <td>
                                                    <strong>{articulo.nombre}</strong>
                                                </td>

                                                <td>{articulo.categoria}</td>

                                                <td>
                                                    {articulo.stock_actual}
                                                    {" "}
                                                    {articulo.unidad_medida}
                                                </td>

                                                <td>
                                                    <div className="minimo-campo">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={valorDe(articulo)}
                                                            onChange={(e) =>
                                                                cambiarMinimo(
                                                                    articulo.id,
                                                                    e.target.value
                                                                )
                                                            }
                                                            className={editado ? "editado" : ""}
                                                            aria-label={
                                                                `Stock mínimo de ${articulo.nombre}`
                                                            }
                                                        />
                                                        <small>{articulo.unidad_medida}</small>
                                                    </div>
                                                </td>

                                                <td>
                                                    <span className={`minimo-estado ${estado}`}>
                                                        {estado === "sin-minimo"
                                                            ? "Sin mínimo"
                                                            : estado === "bajo"
                                                                ? "Reponer"
                                                                : "Suficiente"}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="inv-acciones minimo-acciones">
                        <span>
                            {editados > 0
                                ? `${editados} cambio(s) sin guardar`
                                : "Sin cambios pendientes"}
                        </span>

                        <button
                            type="button"
                            className="minimo-descartar"
                            onClick={descartar}
                            disabled={editados === 0 || guardando}
                        >
                            Descartar
                        </button>

                        <button
                            type="button"
                            className="inv-boton"
                            onClick={guardar}
                            disabled={editados === 0 || guardando}
                        >
                            {guardando ? "Guardando..." : "Guardar mínimos →"}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default StockMinimo;
