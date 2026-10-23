
import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import "../InventarioComun.css";
import "./Stock.css";

function Stock({ navegar }) {
    const [articulos, setArticulos] = useState([]);
    const [existencias, setExistencias] = useState({});
    const [busqueda, setBusqueda] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const cargarStock = async () => {
        setCargando(true);
        setError("");

        try {
            const lista = await inventarioApi.listarArticulos();

            if (!Array.isArray(lista)) {
                throw new Error("El catálogo no devolvió una lista válida.");
            }

            setArticulos(lista);

            const resultados = await Promise.allSettled(
                lista.map((articulo) =>
                    inventarioApi.consultarStock(articulo.id)
                )
            );

            const datos = {};
            let errores = 0;

            resultados.forEach((resultado, indice) => {
                if (resultado.status === "fulfilled") {
                    datos[lista[indice].id] = resultado.value;
                } else {
                    errores++;
                }
            });

            setExistencias(datos);

            if (errores > 0) {
                setError(
                    `No fue posible consultar ${errores} artículo(s).`
                );
            }
        } catch (err) {
            setArticulos([]);
            setExistencias({});
            setError(err.message);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarStock();
    }, []);

    const filtrados = articulos.filter((a) =>
        a.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    const stockBajo = articulos.filter((a) => {
        const dato = existencias[a.id];

        return dato &&
            Number(dato.stock_actual) <= Number(dato.stock_minimo);
    }).length;

    return (
        <section className="inv-pagina stock-pagina">
            <div className="inv-contenedor">
                <button
                    className="inv-volver"
                    onClick={() => navegar("almacen")}
                >
                    ← Volver al almacén
                </button>

                <div className="stock-encabezado">
                    <div>
                        <span className="inv-etiqueta">
                            ✦ CASA AMANDITA · INVENTARIO
                        </span>
                        <h1 className="inv-titulo">
                            Control de <em>stock.</em>
                        </h1>
                        <p className="inv-descripcion">
                            Consultemos los recursos disponibles para
                            cuidar cada detalle de nuestra casa hogar.
                        </p>
                    </div>

                    <button
                        className="inv-boton"
                        onClick={cargarStock}
                        disabled={cargando}
                    >
                        ↻ Actualizar
                    </button>
                </div>

                <div className="stock-resumen">
                    <div className="stock-resumen-card">
                        <span>Artículos</span>
                        <strong>{articulos.length}</strong>
                        <small>Registrados en el sistema</small>
                    </div>

                    <div className="stock-resumen-card">
                        <span>Stock bajo</span>
                        <strong>{stockBajo}</strong>
                        <small>Requieren atención</small>
                    </div>
                </div>

                {error && (
                    <div className="inv-mensaje error" role="alert">
                        ✕ {error}
                    </div>
                )}

                <div className="inv-tarjeta">
                    <div className="stock-tabla-cabecera">
                        <h2>Existencias disponibles</h2>
                        <input
                            type="search"
                            placeholder="Buscar artículo..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            aria-label="Buscar artículo"
                        />
                    </div>

                    {cargando ? (
                        <div className="inv-vacio">Consultando existencias...</div>
                    ) : filtrados.length === 0 ? (
                        <div className="inv-vacio">
                            No hay artículos para mostrar.
                        </div>
                    ) : (
                        <div className="stock-tabla-scroll">
                            <table className="stock-tabla">
                                <thead>
                                    <tr>
                                        <th>Artículo</th>
                                        <th>Stock actual</th>
                                        <th>Stock mínimo</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtrados.map((articulo) => {
                                        const dato = existencias[articulo.id];
                                        const actual = Number(dato?.stock_actual);
                                        const minimo = Number(dato?.stock_minimo);
                                        const tieneDatos = Boolean(dato);
                                        const bajo = tieneDatos && actual <= minimo;

                                        return (
                                            <tr key={articulo.id}>
                                                <td>
                                                    <strong>{articulo.nombre}</strong>
                                                </td>
                                                <td>
                                                    {tieneDatos
                                                        ? `${actual} ${articulo.unidad_medida || ""}`
                                                        : "No disponible"}
                                                </td>
                                                <td>
                                                    {tieneDatos ? minimo : "—"}
                                                </td>
                                                <td>
                                                    <span className={
                                                        "stock-estado " +
                                                        (!tieneDatos
                                                            ? "desconocido"
                                                            : bajo ? "bajo" : "normal")
                                                    }>
                                                        {!tieneDatos
                                                            ? "Sin datos"
                                                            : bajo ? "Stock bajo" : "Disponible"}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default Stock;
