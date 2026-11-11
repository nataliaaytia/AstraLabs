
import { useEffect, useState } from "react";
import { cargarMenus } from "../../data/menus";
import { inventarioApi } from "../../services/inventarioApi";
import "../InventarioComun.css";
import "./PlanificadorComidas.css";

const TIPOS = ["Desayuno", "Almuerzo", "Merienda"];

const NOMBRES_DIAS = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
];

function fechaLocal(fecha = new Date()) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

function desdeFecha(texto) {
    const [anio, mes, dia] = texto.split("-").map(Number);
    return new Date(anio, mes - 1, dia);
}

function obtenerFechas(fecha, modalidad) {
    if (modalidad === "dia") {
        return [fecha];
    }

    const inicio = desdeFecha(fecha);
    const diaSemana = inicio.getDay();

    inicio.setDate(
        inicio.getDate() - ((diaSemana + 6) % 7)
    );

    return Array.from({ length: 7 }, (_, indice) => {
        const siguiente = new Date(inicio);
        siguiente.setDate(inicio.getDate() + indice);
        return fechaLocal(siguiente);
    });
}

function crearDia(fecha) {
    return {
        fecha,
        comensales: "10",
        menus: {
            Desayuno: "",
            Almuerzo: "",
            Merienda: "",
        },
    };
}

function PlanificadorComidas({ navegar }) {
    const [menus, setMenus] = useState([]);
    useEffect(() => {
        cargarMenus().then(setMenus).catch(error => setMensaje({ tipo: "error", texto: error.message }));
    }, []);
    const [modalidad, setModalidad] = useState("semana");
    const [fecha, setFecha] = useState(fechaLocal);
    const [dias, setDias] = useState(() =>
        obtenerFechas(fechaLocal(), "semana").map(crearDia)
    );
    const [mensaje, setMensaje] = useState(null);
    const [guardando, setGuardando] = useState(false);

    const cambiarPeriodo = (nuevaFecha, nuevaModalidad) => {
        setFecha(nuevaFecha);
        setModalidad(nuevaModalidad);

        setDias(
            obtenerFechas(nuevaFecha, nuevaModalidad).map(crearDia)
        );

        setMensaje(null);
    };

    const cambiarComensales = (fechaDia, valor) => {
        setDias((anteriores) =>
            anteriores.map((dia) =>
                dia.fecha === fechaDia
                    ? { ...dia, comensales: valor }
                    : dia
            )
        );
    };

    const cambiarMenu = (fechaDia, tipo, menuId) => {
        setDias((anteriores) =>
            anteriores.map((dia) =>
                dia.fecha === fechaDia
                    ? {
                        ...dia,
                        menus: {
                            ...dia.menus,
                            [tipo]: menuId,
                        },
                    }
                    : dia
            )
        );
    };

    const obtenerMenu = (id) =>
        menus.find((menu) => String(menu.id) === String(id));

    const registrosSeleccionados = dias.flatMap((dia) =>
        TIPOS.filter((tipo) => dia.menus[tipo]).map((tipo) => ({
            fecha: dia.fecha,
            tipoComida: tipo,
            menuId: dia.menus[tipo],
            comensales: Number(dia.comensales),
        }))
    );

    const guardarPlanificacion = async (evento) => {
        evento.preventDefault();

        if (guardando) return;

        setGuardando(true);
        setMensaje(null);

        try {
            const registros = await inventarioApi.guardarPlanificacion(
                registrosSeleccionados
            );

            setMensaje({
                tipo: "exito",
                texto:
                    `Se guardaron ${registros.length} comidas planificadas. ` +
                    "Puedes revisarlas y confirmarlas desde Planes de comida.",
            });

            setDias(
                obtenerFechas(fecha, modalidad).map(crearDia)
            );
        } catch (error) {
            setMensaje({
                tipo: "error",
                texto: error.message,
            });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <section className="inv-pagina planificador-pagina">
            <div className="inv-contenedor">
                <button
                    className="inv-volver"
                    type="button"
                    onClick={() => navegar("almacen")}
                >
                    ← Volver al almacén
                </button>

                <span className="inv-etiqueta">
                    ✦ CASA AMANDITA · ORGANIZACIÓN DE COMIDAS
                </span>

                <h1 className="inv-titulo">
                    Nuestro <em>planificador.</em>
                </h1>

                <p className="inv-descripcion">
                    Organiza las comidas de cada día o de toda
                    la semana, seleccionando los menús y el número
                    de personas que recibirán cada comida.
                </p>

                <div className="planificador-herramientas">
                    <div className="planificador-modalidades">
                        <button
                            type="button"
                            className={modalidad === "dia" ? "activo" : ""}
                            onClick={() => cambiarPeriodo(fecha, "dia")}
                        >
                            Plan diario
                        </button>

                        <button
                            type="button"
                            className={modalidad === "semana" ? "activo" : ""}
                            onClick={() => cambiarPeriodo(fecha, "semana")}
                        >
                            Plan semanal
                        </button>
                    </div>

                    <div className="inv-campo">
                        <label htmlFor="planificador-fecha">
                            {modalidad === "dia"
                                ? "Fecha del plan"
                                : "Seleccionar semana"}
                        </label>

                        <input
                            id="planificador-fecha"
                            type="date"
                            value={fecha}
                            onChange={(e) =>
                                cambiarPeriodo(e.target.value, modalidad)
                            }
                            required
                        />
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

                {menus.length === 0 && (
                    <div className="planificador-aviso">
                        <span>♡</span>
                        <p>
                            Todavía no tienes menús registrados.
                            Primero crea uno en el recetario.
                        </p>

                        <button
                            type="button"
                            onClick={() => navegar("menus")}
                        >
                            Ir al recetario →
                        </button>
                    </div>
                )}

                <form onSubmit={guardarPlanificacion}>
                    <div className="planificador-dias">
                        {dias.map((dia) => {
                            const fechaDia = desdeFecha(dia.fecha);
                            const diaNombre = NOMBRES_DIAS[
                                fechaDia.getDay()
                            ];

                            const seleccionados = TIPOS.filter(
                                (tipo) => Boolean(dia.menus[tipo])
                            ).length;

                            return (
                                <article
                                    className="planificador-dia"
                                    key={dia.fecha}
                                >
                                    <div className="planificador-dia-cabecera">
                                        <div>
                                            <span className="inv-etiqueta">
                                                ✦ {diaNombre}
                                            </span>

                                            <h2>
                                                {fechaDia.toLocaleDateString(
                                                    "es-BO",
                                                    {
                                                        day: "numeric",
                                                        month: "long",
                                                    }
                                                )}
                                            </h2>
                                        </div>

                                        <span className="planificador-contador">
                                            {seleccionados} de 3 comidas
                                        </span>
                                    </div>

                                    <div className="planificador-comensales">
                                        <label
                                            htmlFor={`comensales-${dia.fecha}`}
                                        >
                                            <span>♧</span>
                                            Número de comensales
                                        </label>

                                        <input
                                            id={`comensales-${dia.fecha}`}
                                            type="number"
                                            min="1"
                                            max="1000"
                                            step="1"
                                            value={dia.comensales}
                                            onChange={(e) =>
                                                cambiarComensales(
                                                    dia.fecha,
                                                    e.target.value
                                                )
                                            }
                                            required={seleccionados > 0}
                                        />
                                    </div>

                                    <div className="planificador-comidas">
                                        {TIPOS.map((tipo) => {
                                            const disponibles = menus;

                                            const seleccionado = obtenerMenu(
                                                dia.menus[tipo]
                                            );

                                            return (
                                                <div
                                                    className="planificador-comida"
                                                    key={tipo}
                                                >
                                                    <div className="planificador-comida-titulo">
                                                        <span className="planificador-comida-icono">
                                                            {tipo === "Desayuno"
                                                                ? "☀"
                                                                : tipo === "Almuerzo"
                                                                    ? "♧"
                                                                    : "♡"}
                                                        </span>

                                                        <strong>{tipo}</strong>
                                                    </div>

                                                    <select
                                                        aria-label={
                                                            `${tipo} del ${dia.fecha}`
                                                        }
                                                        value={dia.menus[tipo]}
                                                        onChange={(e) =>
                                                            cambiarMenu(
                                                                dia.fecha,
                                                                tipo,
                                                                e.target.value
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            Sin menú asignado
                                                        </option>

                                                        {disponibles.map(
                                                            (menu) => (
                                                                <option
                                                                    key={menu.id}
                                                                    value={menu.id}
                                                                >
                                                                    {menu.nombre}
                                                                </option>
                                                            )
                                                        )}
                                                    </select>

                                                    {seleccionado && (
                                                        <div className="planificador-detalle">
                                                            {seleccionado.ingredientes.map(
                                                                (ingrediente) => (
                                                                    <span
                                                                        key={ingrediente.articuloId}
                                                                    >
                                                                        {
                                                                            ingrediente.cantidadPorPorcion
                                                                        }
                                                                        {" por porción"}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div className="planificador-pie">
                        <div>
                            <strong>
                                {registrosSeleccionados.length}
                                {" "}
                                comidas seleccionadas
                            </strong>

                            <p>
                                Las comidas se guardarán como borrador.
                                No se descontará stock todavía.
                            </p>
                        </div>

                        <button
                            type="submit"
                            className="inv-boton"
                            disabled={
                                guardando ||
                                registrosSeleccionados.length === 0
                            }
                        >
                            {guardando
                                ? "Guardando..."
                                : "Guardar planificación →"}
                        </button>
                    </div>
                </form>

                <button
                    type="button"
                    className="planificador-ver-planes"
                    onClick={() => navegar("planesComida")}
                >
                    Ver planes registrados y confirmar →
                </button>
            </div>
        </section>
    );
}

export default PlanificadorComidas;
