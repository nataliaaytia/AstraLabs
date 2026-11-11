
import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";

import { cargarMenus } from "../../data/menus";

import "../InventarioComun.css";
import "./PlanesComida.css";

const ESTADOS = {
    borrador: "Borrador",
    confirmado: "Confirmado",
    preparado: "Preparado",
};

function PlanesComida({ navegar, usuarioActual }) {

    const [menusDisponibles, setMenusDisponibles] = useState(cargarMenus);
    const [nuevoPlan, setNuevoPlan] = useState({
        menuId: "",
        porciones: "10",
        fecha: new Date().toLocaleDateString("en-CA"),
    });
    const [creandoPlan, setCreandoPlan] = useState(false);

    const [articulos, setArticulos] = useState([]);
    const [filtro, setFiltro] = useState("todos");
    const [mensaje, setMensaje] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState(null);
    const [planAConfirmar, setPlanAConfirmar] = useState(null);

    const cargarDatos = async () => {
        const [listaPlanes, listaArticulos] = await Promise.all([
            inventarioApi.listarPlanesComida(),
            inventarioApi.listarArticulos(),
        ]);

        setPlanes(listaPlanes);
        setArticulos(listaArticulos);
    };

    useEffect(() => {
        let activo = true;

        const iniciar = async () => {
            try {
                const [listaPlanes, listaArticulos] = await Promise.all([
                    inventarioApi.listarPlanesComida(),
                    inventarioApi.listarArticulos(),
                ]);

                if (activo) {
                    setPlanes(listaPlanes);
                    setArticulos(listaArticulos);
                }
            } catch (error) {
                if (activo) {
                    setMensaje({
                        tipo: "error",
                        texto: error.message,
                    });
                }
            } finally {
                if (activo) setCargando(false);
            }
        };

        iniciar();

        return () => {
            activo = false;
        };
    }, []);


    const guardarNuevoPlan = async (evento) => {
        evento.preventDefault();

        if (creandoPlan) return;

        setCreandoPlan(true);
        setMensaje(null);

        try {
            const creado = await inventarioApi.crearPlanDesdeMenu(nuevoPlan);

            await cargarDatos();
            setMenusDisponibles(cargarMenus());

            setNuevoPlan({
                menuId: "",
                porciones: "10",
                fecha: new Date().toLocaleDateString("en-CA"),
            });

            setMensaje({
                tipo: "exito",
                texto:
                    `El plan "${creado.nombre}" se creó para ` +
                    `${creado.porciones} porciones.`,
            });
        } catch (error) {
            setMensaje({
                tipo: "error",
                texto: error.message,
            });
        } finally {
            setCreandoPlan(false);
        }
    };


    const obtenerArticulo = (id) =>
        articulos.find((a) => String(a.id) === String(id));

    const verificarIngredientes = (plan) => {
        const totales = new Map();

        plan.ingredientes.forEach((ingrediente) => {
            const id = String(ingrediente.articuloId);

            totales.set(
                id,
                (totales.get(id) || 0) + Number(ingrediente.cantidad)
            );
        });

        return [...totales.entries()].every(([id, cantidad]) => {
            const articulo = obtenerArticulo(id);

            return articulo &&
                cantidad <= Number(articulo.stock_actual);
        });
    };


    const confirmarPlan = async (planId) => {
        setMensaje(null);

        try {
            await inventarioApi.confirmarPlanComida(planId);

            await cargarDatos();

            setMensaje({
                tipo: "exito",
                texto:
                    "Plan confirmado correctamente. " +
                    "Ahora está disponible para registrar su preparación.",
            });
        } catch (error) {
            setMensaje({
                tipo: "error",
                texto: error.message,
            });
        }
    };

    const prepararPlan = async () => {
        if (!planAConfirmar || procesando !== null) return;

        const plan = planAConfirmar;

        setProcesando(plan.id);
        setMensaje(null);

        try {
            const resultado = await inventarioApi.prepararPlanComida(
                plan.id,
                usuarioActual?.id
            );

            await cargarDatos();

            setPlanAConfirmar(null);

            setMensaje({
                tipo: "exito",
                texto:
                    `"${resultado.plan}" se marcó como preparado. ` +
                    "Los ingredientes fueron descontados correctamente.",
            });
        } catch (error) {
            setPlanAConfirmar(null);

            setMensaje({
                tipo: "error",
                texto: error.message,
            });
        } finally {
            setProcesando(null);
        }
    };


    const filtrados = planes.filter(
        (plan) => filtro === "todos" || plan.estado === filtro
    );

    const confirmados = planes.filter(
        (plan) => plan.estado === "confirmado"
    ).length;

    const preparados = planes.filter(
        (plan) => plan.estado === "preparado"
    ).length;

    const listaIngredientes = (plan) =>
        plan.ingredientes.map((ingrediente) => {
            const articulo = obtenerArticulo(ingrediente.articuloId);

            return {
                ...ingrediente,
                nombre: articulo?.nombre || "Artículo no encontrado",
                unidad: articulo?.unidad_medida || "",
                disponible: Number(articulo?.stock_actual ?? 0),
                existe: Boolean(articulo),
            };
        });

    return (
        <section className="inv-pagina planes-pagina">
            <div className="inv-contenedor">
                <button
                    type="button"
                    className="inv-volver"
                    onClick={() => navegar("almacen")}
                >
                    ← Volver al almacén
                </button>

                <span className="inv-etiqueta">
                    ✦ CASA AMANDITA · PLANES DE COMIDA
                </span>

                <h1 className="inv-titulo">
                    Preparación de <em>comidas.</em>
                </h1>

                <p className="inv-descripcion">
                    Consulta los planes confirmados y registra su
                    preparación. Cada ingrediente utilizado se
                    descontará automáticamente del inventario.
                </p>


                <div className="inv-tarjeta planes-nuevo-plan">
                    <div className="planes-nuevo-plan-titulo">
                        <div>
                            <span className="inv-etiqueta">
                                ✦ PLANIFICACIÓN
                            </span>
                            <h2>Crear plan desde un menú</h2>
                            <p>
                                Reutiliza una receta y calcula los ingredientes
                                según las porciones.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="planes-ir-recetario"
                            onClick={() => navegar("menus")}
                        >
                            ＋ Registrar menú
                        </button>
                    </div>

                    <form
                        className="inv-formulario"
                        onSubmit={guardarNuevoPlan}
                    >
                        <div className="inv-campo inv-ancho">
                            <label htmlFor="plan-menu">
                                Menú registrado *
                            </label>

                            <select
                                id="plan-menu"
                                value={nuevoPlan.menuId}
                                onChange={(e) =>
                                    setNuevoPlan((anterior) => ({
                                        ...anterior,
                                        menuId: e.target.value,
                                    }))
                                }
                                required
                            >
                                <option value="">
                                    Seleccionar menú
                                </option>

                                {menusDisponibles.map((menu) => (
                                    <option key={menu.id} value={menu.id}>
                                        {menu.nombre} · {menu.tipoComida}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="inv-campo">
                            <label htmlFor="plan-porciones">
                                Número de porciones *
                            </label>

                            <input
                                id="plan-porciones"
                                type="number"
                                min="1"
                                step="1"
                                value={nuevoPlan.porciones}
                                onChange={(e) =>
                                    setNuevoPlan((anterior) => ({
                                        ...anterior,
                                        porciones: e.target.value,
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="inv-campo">
                            <label htmlFor="plan-fecha">
                                Fecha *
                            </label>

                            <input
                                id="plan-fecha"
                                type="date"
                                value={nuevoPlan.fecha}
                                onChange={(e) =>
                                    setNuevoPlan((anterior) => ({
                                        ...anterior,
                                        fecha: e.target.value,
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="inv-acciones">
                            <button
                                type="submit"
                                className="inv-boton"
                                disabled={
                                    creandoPlan ||
                                    menusDisponibles.length === 0
                                }
                            >
                                {creandoPlan
                                    ? "Creando..."
                                    : "Crear plan confirmado →"}
                            </button>
                        </div>
                    </form>
                </div>


                <div className="planes-resumen">
                    <div className="planes-resumen-card">
                        <span>Planes registrados</span>
                        <strong>{planes.length}</strong>
                        <small>Total de planes</small>
                    </div>

                    <div className="planes-resumen-card">
                        <span>Pendientes de preparar</span>
                        <strong>{confirmados}</strong>
                        <small>Planes confirmados</small>
                    </div>

                    <div className="planes-resumen-card">
                        <span>Planes preparados</span>
                        <strong>{preparados}</strong>
                        <small>Con ingredientes descontados</small>
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

                <div className="planes-seccion">
                    <div className="planes-barra">
                        <div>
                            <h2>Planes de comida</h2>
                            <p>
                                Selecciona un plan para confirmar su preparación.
                            </p>
                        </div>

                        <select
                            aria-label="Filtrar planes"
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                        >
                            <option value="todos">Todos los planes</option>
                            <option value="confirmado">Confirmados</option>
                            <option value="preparado">Preparados</option>
                            <option value="borrador">Borradores</option>
                        </select>
                    </div>

                    {cargando ? (
                        <div className="inv-vacio">
                            Cargando planes de comida...
                        </div>
                    ) : filtrados.length === 0 ? (
                        <div className="inv-tarjeta inv-vacio">
                            No hay planes con este estado.
                        </div>
                    ) : (
                        <div className="planes-lista">
                            {filtrados.map((plan) => {
                                const ingredientes = listaIngredientes(plan);
                                const hayStock = verificarIngredientes(plan);
                                const esConfirmado = plan.estado === "confirmado";
                                const esPreparado = plan.estado === "preparado";

                                return (
                                    <article
                                        className="planes-tarjeta"
                                        key={plan.id}
                                    >
                                        <div className="planes-tarjeta-superior">
                                            <div>
                                                <span className="planes-tipo">
                                                    ✦ {plan.tipoComida}
                                                </span>

                                                <h3>{plan.nombre}</h3>

                                                <p className="planes-fecha">
                                                    Fecha: {plan.fecha}
                                                </p>
                                            </div>

                                            <span
                                                className={
                                                    `planes-estado ${plan.estado}`
                                                }
                                            >
                                                {ESTADOS[plan.estado] ||
                                                    plan.estado}
                                            </span>
                                        </div>

                                        <div className="planes-ingredientes">
                                            <h4>Ingredientes necesarios</h4>

                                            {ingredientes.map((ingrediente) => (
                                                <div
                                                    key={ingrediente.articuloId}
                                                    className="planes-ingrediente"
                                                >
                                                    <span>
                                                        {ingrediente.nombre}
                                                    </span>

                                                    <strong>
                                                        {ingrediente.cantidad}
                                                        {" "}
                                                        {ingrediente.unidad}
                                                    </strong>

                                                    {esConfirmado && (
                                                        <small>
                                                            Stock:{" "}
                                                            {ingrediente.disponible}
                                                        </small>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="planes-tarjeta-pie">
                                            {esPreparado ? (
                                                <div className="planes-confirmacion">
                                                    <strong>
                                                        ✓ Preparación registrada
                                                    </strong>
                                                    <span>
                                                        Los ingredientes ya
                                                        fueron descontados.
                                                    </span>

                                                    {Array.isArray(plan.lotesConsumidos) &&
                                                        plan.lotesConsumidos.length > 0 && (
                                                            <div className="planes-lotes-consumidos">
                                                                <h4>Lotes utilizados (FEFO)</h4>

                                                                {plan.lotesConsumidos.map((lote, indice) => (
                                                                    <div
                                                                        key={`${lote.loteId}-${indice}`}
                                                                        className="planes-lote-consumido"
                                                                    >
                                                                        <div>
                                                                            <strong>{lote.articulo}</strong>
                                                                            <small>
                                                                                Lote: {lote.codigoLote}
                                                                                {" · "}
                                                                                Vence: {lote.fechaVencimiento || "Sin fecha"}
                                                                            </small>
                                                                        </div>

                                                                        <span>
                                                                            −{lote.cantidad} {lote.unidad}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                </div>
                                            ) : esConfirmado ? (
                                                <>
                                                    {!hayStock && (
                                                        <p className="planes-advertencia">
                                                            Stock insuficiente
                                                            o ingrediente no disponible.
                                                        </p>
                                                    )}

                                                    <button
                                                        type="button"
                                                        className="inv-boton"
                                                        disabled={
                                                            !hayStock ||
                                                            procesando !== null
                                                        }
                                                        onClick={() =>
                                                            setPlanAConfirmar(plan)
                                                        }
                                                    >
                                                        {procesando === plan.id
                                                            ? "Registrando..."
                                                            : "Marcar como preparado →"}
                                                    </button>
                                                </>
                                            ) : (

                                                <div className="planes-borrador-acciones">
                                                    <p className="planes-borrador">
                                                        Este plan está en borrador.
                                                        Confírmalo para habilitar su preparación.
                                                    </p>

                                                    <button
                                                        type="button"
                                                        className="inv-boton"
                                                        onClick={() => confirmarPlan(plan.id)}
                                                    >
                                                        Confirmar plan →
                                                    </button>
                                                </div>

                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>


            {planAConfirmar && (
                <div
                    className="plan-modal-fondo"
                    onMouseDown={(evento) => {
                        if (
                            evento.target === evento.currentTarget &&
                            procesando === null
                        ) {
                            setPlanAConfirmar(null);
                        }
                    }}
                >
                    <div
                        className="plan-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="plan-modal-titulo"
                    >
                        <button
                            type="button"
                            className="plan-modal-cerrar"
                            onClick={() => setPlanAConfirmar(null)}
                            disabled={procesando !== null}
                            aria-label="Cerrar modal"
                        >
                            ×
                        </button>

                        <div className="plan-modal-icono">
                            ♡
                        </div>

                        <span className="plan-modal-etiqueta">
                            ✦ CONFIRMACIÓN DE PREPARACIÓN
                        </span>

                        <h2 id="plan-modal-titulo">
                            ¿Confirmar <em>preparación?</em>
                        </h2>

                        <p className="plan-modal-descripcion">
                            Estás a punto de marcar
                            <strong> {planAConfirmar.nombre} </strong>
                            como preparado.
                            Los siguientes ingredientes se descontarán
                            automáticamente del inventario.
                        </p>

                        <div className="plan-modal-ingredientes">
                            <h3>Ingredientes a descontar</h3>

                            {listaIngredientes(planAConfirmar).map(
                                (ingrediente) => (
                                    <div
                                        className="plan-modal-ingrediente"
                                        key={ingrediente.articuloId}
                                    >
                                        <span>{ingrediente.nombre}</span>

                                        <strong>
                                            −{ingrediente.cantidad}
                                            {" "}
                                            {ingrediente.unidad}
                                        </strong>
                                    </div>
                                )
                            )}
                        </div>

                        <div className="plan-modal-aviso">
                            <span>✦</span>
                            <p>
                                Una vez confirmado, este plan quedará
                                registrado como preparado y no podrá
                                descontarse nuevamente.
                            </p>
                        </div>

                        <div className="plan-modal-acciones">
                            <button
                                type="button"
                                className="plan-modal-cancelar"
                                onClick={() => setPlanAConfirmar(null)}
                                disabled={procesando !== null}
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                className="plan-modal-confirmar"
                                onClick={prepararPlan}
                                disabled={procesando !== null}
                            >
                                {procesando !== null
                                    ? "Registrando..."
                                    : "Sí, confirmar ✓"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </section>
    );
}

export default PlanesComida;
