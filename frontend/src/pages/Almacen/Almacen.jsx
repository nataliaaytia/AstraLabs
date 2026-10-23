
import { useState } from "react";
import ModalArticulo from "../../components/Articulos/ModalArticulo";
import ModalExcedente from "../../components/Excedentes/Excedente";
import {
    CATEGORIAS,
    UNIDADES_MEDIDA,
    cargarArticulos,
    guardarArticulos,
} from "../../data/catalogo";
import {
    DESTINOS_EXCEDENTE,
    cargarExcedentes,
    guardarExcedentes,
} from "../../data/excedentes";

import "./Almacen.css";

function Almacen({ navegar }) {
    const [articulos, setArticulos] = useState(cargarArticulos);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [busqueda, setBusqueda] = useState("");
    const [filtroCategoria, setFiltroCategoria] = useState("");
    const [mensaje, setMensaje] = useState(null);
    const [excedentes, setExcedentes] = useState(cargarExcedentes);
    const [articuloExcedente, setArticuloExcedente] = useState(null);

    // Registrar un artículo nuevo
    const registrarArticulo = (nuevoArticulo) => {
        const nombre = nuevoArticulo.nombre.trim().replace(/\s+/g, " ");

        if (
            !nombre ||
            !CATEGORIAS.includes(nuevoArticulo.categoria) ||
            !UNIDADES_MEDIDA.includes(nuevoArticulo.unidadMedida)
        ) {
            return {
                exito: false,
                mensaje: "Completa correctamente todos los campos.",
            };
        }

        const normalizar = (texto) =>
            texto.normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .trim();

        const duplicado = articulos.some(
            (articulo) =>
                normalizar(articulo.nombre) === normalizar(nombre) &&
                articulo.categoria === nuevoArticulo.categoria
        );

        if (duplicado) {
            return {
                exito: false,
                mensaje: "Ya existe un artículo con ese nombre en esta categoría.",
            };
        }

        const articulo = {
            id: crypto.randomUUID(),
            nombre,
            categoria: nuevoArticulo.categoria,
            unidadMedida: nuevoArticulo.unidadMedida,
            fechaRegistro: new Date().toISOString(),
        };

        const actualizados = [...articulos, articulo];

        if (!guardarArticulos(actualizados)) {
            return {
                exito: false,
                mensaje: "No fue posible guardar el artículo.",
            };
        }

        setArticulos(actualizados);
        setMensaje({
            tipo: "exito",
            texto: `"${nombre}" se registró correctamente en el catálogo.`,
        });

        return {
            exito: true,
            mensaje: "Artículo registrado correctamente.",
        };
    };

    // HU-09
    const registrarExcedente = ({ articuloId, cantidad, destino, observaciones }) => {
        const articulo = articulos.find((a) => a.id === articuloId);

        if (!articulo) {
            return { exito: false, mensaje: "El artículo ya no existe en el catálogo." };
        }

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            return { exito: false, mensaje: "Ingresa una cantidad mayor a cero." };
        }

        if (!DESTINOS_EXCEDENTE.includes(destino)) {
            return { exito: false, mensaje: "Selecciona el destino del excedente." };
        }

        const excedente = {
            id: crypto.randomUUID(),
            articuloId,
            articulo: articulo.nombre,
            unidadMedida: articulo.unidadMedida,
            cantidad,
            destino,
            observaciones,
            fecha: new Date().toISOString(),
        };

        const actualizados = [excedente, ...excedentes];

        if (!guardarExcedentes(actualizados)) {
            return { exito: false, mensaje: "No fue posible registrar el excedente." };
        }

        setExcedentes(actualizados);
        setMensaje({
            tipo: "exito",
            texto: `"${articulo.nombre}" se marcó como excedente con destino: ${destino}.`,
        });

        return { exito: true, mensaje: "Excedente registrado correctamente." };
    };

    // Buscar y filtrar
    const articulosFiltrados = articulos.filter((articulo) => {
        const coincideNombre = articulo.nombre
            .toLowerCase()
            .includes(busqueda.toLowerCase().trim());

        const coincideCategoria =
            !filtroCategoria ||
            articulo.categoria === filtroCategoria;

        return coincideNombre && coincideCategoria;
    });

    const categoriasUsadas = new Set(
        articulos.map((articulo) => articulo.categoria)
    ).size;

    return (
        <section className="almacen-pagina">
            <div className="almacen-contenedor">


                {/* ACCESOS A FUNCIONALIDADES DEL ALMACÉN */}
                <div className="almacen-accesos">
                    <button
                        className="almacen-acceso"
                        onClick={() => navegar("stock")}
                    >
                        <span className="almacen-acceso-icono">▦</span>
                        <strong>Control de stock</strong>
                        <small>Consultar existencias y alertas</small>
                        <span className="almacen-acceso-flecha">↗</span>
                    </button>

                    <button
                        className="almacen-acceso"
                        onClick={() => navegar("salidas")}
                    >
                        <span className="almacen-acceso-icono">↗</span>
                        <strong>Registrar salidas</strong>
                        <small>Controlar artículos utilizados</small>
                        <span className="almacen-acceso-flecha">↗</span>
                    </button>

                    <button
                        className="almacen-acceso"
                        onClick={() => navegar("mermas")}
                    >
                        <span className="almacen-acceso-icono">✿</span>
                        <strong>Registrar mermas</strong>
                        <small>Documentar pérdidas de artículos</small>
                        <span className="almacen-acceso-flecha">↗</span>
                    </button>
                </div>


                <div className="almacen-encabezado">
                    <div>
                        <span className="almacen-etiqueta">
                            ✦ CASA AMANDITA · GESTIÓN DE INVENTARIO
                        </span>

                        <h1>
                            Nuestro <em>almacén</em>
                        </h1>

                        <p>
                            Cada recurso cuenta. Organicemos con cariño
                            los artículos que acompañan el bienestar
                            de nuestra familia.
                        </p>
                    </div>

                    <button
                        className="almacen-nuevo"
                        onClick={() => {
                            setMensaje(null);
                            setModalAbierto(true);
                        }}
                    >
                        <span aria-hidden="true">＋</span> Nuevo artículo
                    </button>
                </div>

                <div className="almacen-estadisticas">
                    <div className="almacen-estadistica">
                        <span>Artículos registrados</span>
                        <strong>{articulos.length}</strong>
                        <small>En nuestro catálogo</small>
                    </div>

                    <div className="almacen-estadistica">
                        <span>Categorías utilizadas</span>
                        <strong>{categoriasUsadas}</strong>
                        <small>De {CATEGORIAS.length} disponibles</small>
                    </div>

                    <div className="almacen-estadistica almacen-estadistica-especial">
                        <span aria-hidden="true" className="almacen-estadistica-corazon">
                            ♡
                        </span>
                        <p>
                            Organizando recursos,
                            <br />
                            <em>cuidando personas.</em>
                        </p>
                    </div>
                </div>

                {mensaje && (
                    <div
                        className={`almacen-mensaje almacen-mensaje-${mensaje.tipo}`}
                        role="status"
                    >
                        <span aria-hidden="true">✓</span>
                        {mensaje.texto}
                        <button
                            onClick={() => setMensaje(null)}
                            aria-label="Cerrar mensaje"
                        >
                            ×
                        </button>
                    </div>
                )}

                <div className="almacen-catalogo">
                    <div className="almacen-catalogo-cabecera">
                        <div>
                            <h2>Catálogo de artículos</h2>
                            <p>
                                Consulta los artículos registrados
                                y sus respectivas categorías.
                            </p>
                        </div>

                        <span className="almacen-total">
                            {articulosFiltrados.length} artículos
                        </span>
                    </div>

                    <div className="almacen-filtros">
                        <input
                            type="search"
                            placeholder="Buscar artículo por nombre..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            aria-label="Buscar artículos"
                        />

                        <select
                            value={filtroCategoria}
                            onChange={(e) => setFiltroCategoria(e.target.value)}
                            aria-label="Filtrar por categoría"
                        >
                            <option value="">Todas las categorías</option>

                            {CATEGORIAS.map((categoria) => (
                                <option key={categoria} value={categoria}>
                                    {categoria}
                                </option>
                            ))}
                        </select>
                    </div>

                    {articulosFiltrados.length > 0 ? (
                        <div className="almacen-tabla-contenedor">
                            <table className="almacen-tabla">
                                <thead>
                                    <tr>
                                        <th>Artículo</th>
                                        <th>Categoría</th>
                                        <th>Unidad de medida</th>
                                        <th>Fecha de registro</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {articulosFiltrados.map((articulo) => (
                                        <tr key={articulo.id}>
                                            <td>
                                                <div className="almacen-articulo-nombre">
                                                    <span className="almacen-articulo-icono">
                                                        ✿
                                                    </span>
                                                    <strong>{articulo.nombre}</strong>
                                                </div>
                                            </td>

                                            <td>
                                                <span className="almacen-categoria">
                                                    {articulo.categoria}
                                                </span>
                                            </td>

                                            <td>{articulo.unidadMedida}</td>

                                            <td>
                                                {new Date(
                                                    articulo.fechaRegistro
                                                ).toLocaleDateString("es-BO")}
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className="almacen-excedente-boton"
                                                    onClick={() => {
                                                        setMensaje(null);
                                                        setArticuloExcedente(articulo);
                                                    }}
                                                >
                                                    Marcar excedente
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="almacen-vacio">
                            <div className="almacen-vacio-icono">౨ৎ⋆˚｡⋆</div>

                            <h3>
                                {articulos.length === 0
                                    ? "Nuestro catálogo está vacio w"
                                    : "No encontramos artículos"}
                            </h3>

                            <p>
                                {articulos.length === 0
                                    ? "Comienza registrando el primer artículo del almacén"
                                    : "Prueba con otra búsqueda o categoría"}
                            </p>

                            {articulos.length === 0 && (
                                <button
                                    onClick={() => setModalAbierto(true)}
                                >
                                    Registrar artículo →
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="almacen-catalogo almacen-excedentes">
                    <div className="almacen-catalogo-cabecera">
                        <div>
                            <h2>Excedentes registrados</h2>
                            <p>Historial de artículos marcados como excedente y su destino.</p>
                        </div>

                        <span className="almacen-total">
                            {excedentes.length} registros
                        </span>
                    </div>

                    {excedentes.length > 0 ? (
                        <div className="almacen-tabla-contenedor">
                            <table className="almacen-tabla">
                                <thead>
                                    <tr>
                                        <th>Artículo</th>
                                        <th>Cantidad</th>
                                        <th>Destino</th>
                                        <th>Observaciones</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {excedentes.map((excedente) => (
                                        <tr key={excedente.id}>
                                            <td><strong>{excedente.articulo}</strong></td>
                                            <td>{excedente.cantidad} {excedente.unidadMedida}</td>
                                            <td>{excedente.destino}</td>
                                            <td>{excedente.observaciones || "—"}</td>
                                            <td>
                                                {new Date(excedente.fecha).toLocaleDateString("es-BO")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="almacen-excedentes-vacio">
                            Aún no hay excedentes registrados.
                        </p>
                    )}
                </div>

                <button
                    className="almacen-volver"
                    onClick={() => navegar("home")}
                >
                    ← Volver al inicio
                </button>

            </div>

            <ModalExcedente
                articulo={articuloExcedente}
                onCerrar={() => setArticuloExcedente(null)}
                onGuardar={registrarExcedente}
            />

            <ModalArticulo
                abierto={modalAbierto}
                onCerrar={() => setModalAbierto(false)}
                onGuardar={registrarArticulo}
            />
        </section>
    );
}
export default Almacen;