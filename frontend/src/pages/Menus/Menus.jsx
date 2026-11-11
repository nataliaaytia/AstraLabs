
import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import { cargarMenus, registrarMenu } from "../../data/menus";
import "../InventarioComun.css";
import "./Menus.css";

const FORMULARIO_INICIAL = {
    nombre: "",
    descripcion: "",
    tipoComida: "Almuerzo",
    ingredientes: [
        { articuloId: "", cantidadPorPorcion: "" },
    ],
};

function Menus({ navegar }) {
    const [articulos, setArticulos] = useState([]);
    const [menus, setMenus] = useState(cargarMenus);
    const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
    const [busqueda, setBusqueda] = useState("");
    const [mensaje, setMensaje] = useState(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        inventarioApi.listarArticulos()
            .then(setArticulos)
            .catch((error) => {
                setMensaje({
                    tipo: "error",
                    texto: error.message,
                });
            })
            .finally(() => setCargando(false));
    }, []);

    const cambiarCampo = (evento) => {
        const { name, value } = evento.target;

        setFormulario((anterior) => ({
            ...anterior,
            [name]: value,
        }));

        setMensaje(null);
    };

    const cambiarIngrediente = (indice, campo, valor) => {
        setFormulario((anterior) => ({
            ...anterior,
            ingredientes: anterior.ingredientes.map((ingrediente, i) =>
                i === indice
                    ? { ...ingrediente, [campo]: valor }
                    : ingrediente
            ),
        }));

        setMensaje(null);
    };

    const agregarIngrediente = () => {
        setFormulario((anterior) => ({
            ...anterior,
            ingredientes: [
                ...anterior.ingredientes,
                { articuloId: "", cantidadPorPorcion: "" },
            ],
        }));
    };

    const quitarIngrediente = (indice) => {
        setFormulario((anterior) => ({
            ...anterior,
            ingredientes: anterior.ingredientes.filter(
                (_, i) => i !== indice
            ),
        }));
    };

    const guardarMenu = (evento) => {
        evento.preventDefault();
        setMensaje(null);

        try {
            const nuevo = registrarMenu(formulario, articulos);

            setMenus(cargarMenus());
            setFormulario({
                ...FORMULARIO_INICIAL,
                ingredientes: [
                    { articuloId: "", cantidadPorPorcion: "" },
                ],
            });

            setMensaje({
                tipo: "exito",
                texto: `El menú "${nuevo.nombre}" se registró correctamente.`,
            });
        } catch (error) {
            setMensaje({
                tipo: "error",
                texto: error.message,
            });
        }
    };

    const obtenerArticulo = (id) =>
        articulos.find((a) => String(a.id) === String(id));

    const filtrados = menus.filter((menu) =>
        menu.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        menu.tipoComida.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <section className="inv-pagina menus-pagina">
            <div className="inv-contenedor">
                <button
                    type="button"
                    className="inv-volver"
                    onClick={() => navegar("almacen")}
                >
                    ← Volver al almacén
                </button>

                <span className="inv-etiqueta">
                    ✦ CASA AMANDITA · ALMACÉN Y COCINA
                </span>

                <h1 className="inv-titulo">
                    Nuestro <em>recetario.</em>
                </h1>

                <p className="inv-descripcion">
                    Registra menús con sus ingredientes y cantidades
                    por porción para reutilizarlos al planificar comidas.
                </p>

                <div className="menus-resumen">
                    <div>
                        <span>Menús registrados</span>
                        <strong>{menus.length}</strong>
                        <small>Disponibles para planificar</small>
                    </div>
                    <div>
                        <span>Ingredientes disponibles</span>
                        <strong>{articulos.length}</strong>
                        <small>Artículos del catálogo</small>
                    </div>
                </div>

                <div className="menus-distribucion">
                    <div className="inv-tarjeta">
                        <h2>Registrar nuevo menú</h2>
                        <p className="menus-ayuda">
                            Las cantidades se registran para una sola porción.
                        </p>

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

                        <form
                            className="inv-formulario"
                            onSubmit={guardarMenu}
                        >
                            <div className="inv-campo inv-ancho">
                                <label htmlFor="menu-nombre">
                                    Nombre del menú *
                                </label>
                                <input
                                    id="menu-nombre"
                                    type="text"
                                    name="nombre"
                                    maxLength={120}
                                    placeholder="Ej. Arroz con leche"
                                    value={formulario.nombre}
                                    onChange={cambiarCampo}
                                    required
                                />
                            </div>

                            <div className="inv-campo inv-ancho">
                                <label htmlFor="menu-tipo">
                                    Tipo de comida *
                                </label>
                                <select
                                    id="menu-tipo"
                                    name="tipoComida"
                                    value={formulario.tipoComida}
                                    onChange={cambiarCampo}
                                >
                                    <option>Desayuno</option>
                                    <option>Almuerzo</option>
                                    <option>Merienda</option>
                                    <option>Otro</option>
                                </select>
                            </div>

                            <div className="inv-campo inv-ancho">
                                <label htmlFor="menu-descripcion">
                                    Descripción (opcional)
                                </label>
                                <input
                                    id="menu-descripcion"
                                    type="text"
                                    name="descripcion"
                                    maxLength={250}
                                    placeholder="Ej. Merienda para adultos mayores"
                                    value={formulario.descripcion}
                                    onChange={cambiarCampo}
                                />
                            </div>

                            <div className="menus-ingredientes inv-ancho">
                                <div className="menus-ingredientes-titulo">
                                    <div>
                                        <h3>Ingredientes por porción</h3>
                                        <p>
                                            Selecciona el artículo y la cantidad
                                            necesaria para una persona.
                                        </p>
                                    </div>
                                </div>

                                {formulario.ingredientes.map((ingrediente, indice) => {
                                    const articulo = obtenerArticulo(
                                        ingrediente.articuloId
                                    );

                                    return (
                                        <div
                                            className="menus-ingrediente-fila"
                                            key={indice}
                                        >
                                            <div className="inv-campo">
                                                <label>
                                                    Ingrediente {indice + 1}
                                                </label>

                                                <select
                                                    aria-label={`Ingrediente ${indice + 1}`}
                                                    value={ingrediente.articuloId}
                                                    onChange={(evento) =>
                                                        cambiarIngrediente(
                                                            indice,
                                                            "articuloId",
                                                            evento.target.value
                                                        )
                                                    }
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

                                            <div className="inv-campo">
                                                <label>
                                                    Cantidad por porción
                                                    {articulo
                                                        ? ` (${articulo.unidad_medida})`
                                                        : ""}
                                                </label>

                                                <input
                                                    type="number"
                                                    min="0.001"
                                                    step="any"
                                                    placeholder="Ej. 0.15"
                                                    value={ingrediente.cantidadPorPorcion}
                                                    onChange={(evento) =>
                                                        cambiarIngrediente(
                                                            indice,
                                                            "cantidadPorPorcion",
                                                            evento.target.value
                                                        )
                                                    }
                                                    required
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                className="menus-quitar"
                                                onClick={() =>
                                                    quitarIngrediente(indice)
                                                }
                                                disabled={
                                                    formulario.ingredientes.length === 1
                                                }
                                                aria-label={`Eliminar ingrediente ${indice + 1}`}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    className="menus-agregar"
                                    onClick={agregarIngrediente}
                                >
                                    ＋ Agregar ingrediente
                                </button>
                            </div>

                            <div className="inv-acciones">
                                <button
                                    type="submit"
                                    className="inv-boton"
                                    disabled={cargando || articulos.length === 0}
                                >
                                    Guardar menú →
                                </button>
                            </div>
                        </form>
                    </div>

                    <aside className="menus-directorio">
                        <div className="menus-directorio-encabezado">
                            <span>✦ RECETARIO</span>
                            <h2>Menús disponibles</h2>

                            <input
                                type="search"
                                placeholder="Buscar menú..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                aria-label="Buscar menú"
                            />
                        </div>

                        {filtrados.length === 0 ? (
                            <div className="inv-vacio">
                                {menus.length === 0
                                    ? "Todavía no hay menús registrados."
                                    : "No se encontraron menús."}
                            </div>
                        ) : (
                            <div className="menus-lista">
                                {filtrados.map((menu) => (
                                    <article className="menus-registro" key={menu.id}>
                                        <span className="menus-tipo">
                                            {menu.tipoComida}
                                        </span>

                                        <h3>{menu.nombre}</h3>

                                        {menu.descripcion && (
                                            <p>{menu.descripcion}</p>
                                        )}

                                        <div className="menus-detalle">
                                            {menu.ingredientes.map((i) => {
                                                const articulo = obtenerArticulo(
                                                    i.articuloId
                                                );

                                                return (
                                                    <div key={i.articuloId}>
                                                        <span>
                                                            {articulo?.nombre ||
                                                                "Artículo no disponible"}
                                                        </span>
                                                        <strong>
                                                            {i.cantidadPorPorcion}
                                                            {" "}
                                                            {articulo?.unidad_medida || ""}
                                                        </strong>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            className="menus-planificar"
                                            onClick={() => navegar("planesComida")}
                                        >
                                            Usar en planificación ↗
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </section>
    );
}

export default Menus;
