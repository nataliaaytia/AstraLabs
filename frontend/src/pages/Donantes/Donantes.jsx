
import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import "../InventarioComun.css";
import "./Donantes.css";

const FORMULARIO_INICIAL = {
    tipo: "persona",
    nombre: "",
    contacto: "",
    telefono: "",
    correo: "",
};

function Donantes({ navegar }) {
    const [donantes, setDonantes] = useState([]);
    const [formulario, setFormulario] = useState({
        ...FORMULARIO_INICIAL,
    });
    const [busqueda, setBusqueda] = useState("");
    const [mensaje, setMensaje] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);

    const cargarDatos = async () => {
        setCargando(true);

        try {
            const datos = await inventarioApi.listarDonantes();

            if (!Array.isArray(datos)) {
                throw new Error("El backend no devolvió una lista de donantes.");
            }

            setDonantes(datos);
        } catch (error) {
            setMensaje({
                tipo: "error",
                texto: error.message || "No se pudieron cargar los donantes.",
            });
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const cambiarCampo = (evento) => {
        const { name, value } = evento.target;

        setFormulario((anterior) => ({
            ...anterior,
            [name]: value,
        }));

        setMensaje(null);
    };

    const guardarDonante = async (evento) => {
        evento.preventDefault();
        setMensaje(null);

        if (!formulario.nombre.trim()) {
            setMensaje({
                tipo: "error",
                texto: "Ingresa el nombre del donante.",
            });
            return;
        }

        if (!formulario.contacto.trim()) {
            setMensaje({
                tipo: "error",
                texto: "Ingresa el nombre de contacto.",
            });
            return;
        }

        if (!formulario.telefono.trim() && !formulario.correo.trim()) {
            setMensaje({
                tipo: "error",
                texto: "Ingresa al menos un teléfono o correo electrónico.",
            });
            return;
        }

        setGuardando(true);

        try {
            await inventarioApi.crearDonante({
                tipo: formulario.tipo,
                nombre: formulario.nombre.trim(),
                contacto: formulario.contacto.trim(),
                telefono: formulario.telefono.trim(),
                correo: formulario.correo.trim(),
            });

            await cargarDatos();

            setFormulario({ ...FORMULARIO_INICIAL });

            setMensaje({
                tipo: "exito",
                texto: `"${formulario.nombre}" se registró correctamente.`,
            });
        } catch (error) {
            setMensaje({
                tipo: "error",
                texto: error.message || "No se pudo registrar el donante.",
            });
        } finally {
            setGuardando(false);
        }
    };

    const filtrados = donantes.filter((donante) => {
        const texto = busqueda.toLowerCase().trim();

        const nombre = String(donante.nombre || "").toLowerCase();
        const contacto = String(donante.contacto || "").toLowerCase();
        const tipo = String(donante.tipo || "").toLowerCase();

        return (
            nombre.includes(texto) ||
            contacto.includes(texto) ||
            tipo.includes(texto)
        );
    });

    const totalPersonas = donantes.filter(
        (d) => d.tipo === "persona"
    ).length;

    const totalEmpresas = donantes.filter(
        (d) => d.tipo === "empresa"
    ).length;

    return (
        <section className="inv-pagina donantes-pagina">
            <div className="inv-contenedor">
                <button
                    type="button"
                    className="inv-volver"
                    onClick={() => navegar("donaciones")}
                >
                    ← Volver a donaciones
                </button>

                <span className="inv-etiqueta">
                    ✦ CASA AMANDITA · RECEPCIÓN
                </span>

                <h1 className="inv-titulo">
                    Nuestros <em>benefactores.</em>
                </h1>

                <p className="inv-descripcion">
                    Registremos a las personas y empresas que
                    contribuyen al bienestar de nuestra casa hogar.
                </p>

                <div className="donantes-resumen">
                    <div className="donantes-resumen-card">
                        <span>Total de donantes</span>
                        <strong>{donantes.length}</strong>
                        <small>Registrados</small>
                    </div>

                    <div className="donantes-resumen-card">
                        <span>Personas</span>
                        <strong>{totalPersonas}</strong>
                        <small>Donantes particulares</small>
                    </div>

                    <div className="donantes-resumen-card">
                        <span>Empresas</span>
                        <strong>{totalEmpresas}</strong>
                        <small>Empresas benefactoras</small>
                    </div>
                </div>

                <div className="donantes-distribucion">
                    <div className="inv-tarjeta">
                        <h2>Registrar nuevo donante</h2>

                        <p className="donantes-subtitulo">
                            Completa los datos para asociar
                            al benefactor con futuras donaciones.
                        </p>

                        {mensaje && (
                            <div
                                className={`inv-mensaje ${mensaje.tipo}`}
                                role="status"
                            >
                                {mensaje.tipo === "exito" ? "✓" : "✕"}{" "}
                                {mensaje.texto}
                            </div>
                        )}

                        <form
                            className="inv-formulario"
                            onSubmit={guardarDonante}
                        >
                            <div className="inv-campo inv-ancho">
                                <label htmlFor="donante-tipo">
                                    Tipo de donante *
                                </label>

                                <select
                                    id="donante-tipo"
                                    name="tipo"
                                    value={formulario.tipo}
                                    onChange={cambiarCampo}
                                >
                                    <option value="persona">
                                        Persona natural
                                    </option>

                                    <option value="empresa">
                                        Empresa benefactora
                                    </option>
                                </select>
                            </div>

                            <div className="inv-campo inv-ancho">
                                <label htmlFor="donante-nombre">
                                    {formulario.tipo === "empresa"
                                        ? "Nombre de la empresa *"
                                        : "Nombre completo *"}
                                </label>

                                <input
                                    id="donante-nombre"
                                    name="nombre"
                                    type="text"
                                    maxLength={120}
                                    placeholder={
                                        formulario.tipo === "empresa"
                                            ? "Ej. Fundación Esperanza"
                                            : "Ej. María Pérez"
                                    }
                                    value={formulario.nombre}
                                    onChange={cambiarCampo}
                                    required
                                />
                            </div>

                            <div className="inv-campo inv-ancho">
                                <label htmlFor="donante-contacto">
                                    {formulario.tipo === "empresa"
                                        ? "Persona de contacto *"
                                        : "Nombre de contacto *"}
                                </label>

                                <input
                                    id="donante-contacto"
                                    name="contacto"
                                    type="text"
                                    maxLength={120}
                                    placeholder="Ej. María Pérez"
                                    value={formulario.contacto}
                                    onChange={cambiarCampo}
                                    required
                                />
                            </div>

                            <div className="inv-campo">
                                <label htmlFor="donante-telefono">
                                    Teléfono
                                </label>

                                <input
                                    id="donante-telefono"
                                    name="telefono"
                                    type="tel"
                                    maxLength={25}
                                    placeholder="Ej. 70123456"
                                    value={formulario.telefono}
                                    onChange={cambiarCampo}
                                />
                            </div>

                            <div className="inv-campo">
                                <label htmlFor="donante-correo">
                                    Correo electrónico
                                </label>

                                <input
                                    id="donante-correo"
                                    name="correo"
                                    type="email"
                                    maxLength={120}
                                    placeholder="Ej. contacto@correo.com"
                                    value={formulario.correo}
                                    onChange={cambiarCampo}
                                />
                            </div>

                            <p className="donantes-nota inv-ancho">
                                * Campos obligatorios. Ingresa al menos
                                un teléfono o correo electrónico.
                            </p>

                            <div className="inv-acciones">
                                <button
                                    type="submit"
                                    className="inv-boton"
                                    disabled={guardando}
                                >
                                    {guardando
                                        ? "Registrando..."
                                        : "Registrar donante →"}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="donantes-directorio">
                        <div className="donantes-directorio-cabecera">
                            <span>✦ DIRECTORIO</span>

                            <h2>Donantes registrados</h2>

                            <input
                                type="search"
                                placeholder="Buscar donante..."
                                value={busqueda}
                                onChange={(e) =>
                                    setBusqueda(e.target.value)
                                }
                                aria-label="Buscar donante"
                            />
                        </div>

                        {cargando ? (
                            <div className="inv-vacio">
                                Cargando donantes...
                            </div>
                        ) : filtrados.length === 0 ? (
                            <div className="inv-vacio">
                                {donantes.length === 0
                                    ? "Todavía no hay donantes registrados."
                                    : "No se encontraron coincidencias."}
                            </div>
                        ) : (
                            <div className="donantes-lista">
                                {filtrados.map((donante) => (
                                    <article
                                        className="donantes-registro"
                                        key={donante.id}
                                    >
                                        <span className="donantes-avatar">
                                            {donante.tipo === "empresa"
                                                ? "⌂"
                                                : "♡"}
                                        </span>

                                        <div className="donantes-registro-info">
                                            <strong>
                                                {donante.nombre}
                                            </strong>

                                            <small>
                                                {donante.tipo === "empresa"
                                                    ? "Empresa benefactora"
                                                    : "Persona natural"}
                                            </small>

                                            <p>
                                                Contacto: {donante.contacto}
                                            </p>

                                            {donante.telefono && (
                                                <p>{donante.telefono}</p>
                                            )}

                                            {(donante.email || donante.correo) && (
                                                <p>
                                                    {donante.email || donante.correo}
                                                </p>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}

                        {donantes.length > 0 && (
                            <div className="donantes-directorio-pie">
                                <button
                                    type="button"
                                    onClick={() => navegar("donaciones")}
                                >
                                    Registrar una donación →
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default Donantes;
