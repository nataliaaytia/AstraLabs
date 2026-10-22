
import { useEffect, useState } from "react";
import {
    CATEGORIAS,
    UNIDADES_MEDIDA,
} from "../../data/catalogo";
import "./ModalArticulo.css";

const FORMULARIO_INICIAL = {
    nombre: "",
    categoria: "",
    unidadMedida: "",
};

function ModalArticulo({ abierto, onCerrar, onGuardar }) {
    const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
    const [error, setError] = useState("");

    useEffect(() => {
        if (abierto) {
            setFormulario({ ...FORMULARIO_INICIAL });
            setError("");
        }
    }, [abierto]);

    useEffect(() => {
        if (!abierto) return;

        const manejarTecla = (evento) => {
            if (evento.key === "Escape") onCerrar();
        };

        window.addEventListener("keydown", manejarTecla);
        return () => window.removeEventListener("keydown", manejarTecla);
    }, [abierto, onCerrar]);

    if (!abierto) return null;

    const cambiarCampo = (evento) => {
        const { name, value } = evento.target;

        setFormulario((anterior) => ({
            ...anterior,
            [name]: value,
        }));

        setError("");
    };

    const enviarFormulario = (evento) => {
        evento.preventDefault();

        const resultado = onGuardar({
            nombre: formulario.nombre.trim().replace(/\s+/g, " "),
            categoria: formulario.categoria,
            unidadMedida: formulario.unidadMedida,
        });

        if (!resultado.exito) {
            setError(resultado.mensaje);
            return;
        }

        onCerrar();
    };

    return (
        <div
            className="modal-articulo-fondo"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onCerrar();
            }}
        >
            <section
                className="modal-articulo"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-articulo-titulo"
            >
                <div className="modal-articulo-encabezado">
                    <div>
                        <span className="modal-articulo-etiqueta">
                            ✦ CATÁLOGO DE ALMACÉN
                        </span>
                        <h2 id="modal-articulo-titulo">
                            Nuevo <em>artículo.</em>
                        </h2>
                        <p>
                            Registra un artículo para mantener
                            organizado nuestro catálogo.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="modal-articulo-cerrar"
                        onClick={onCerrar}
                        aria-label="Cerrar formulario"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={enviarFormulario}>
                    <div className="modal-articulo-campo">
                        <label htmlFor="articulo-nombre">
                            Nombre del artículo <span>*</span>
                        </label>

                        <input
                            id="articulo-nombre"
                            name="nombre"
                            value={formulario.nombre}
                            onChange={cambiarCampo}
                            placeholder="Ej. Arroz blanco"
                            maxLength={100}
                            autoFocus
                            required
                        />
                    </div>

                    <div className="modal-articulo-campos-fila">
                        <div className="modal-articulo-campo">
                            <label htmlFor="articulo-categoria">
                                Categoría <span>*</span>
                            </label>

                            <select
                                id="articulo-categoria"
                                name="categoria"
                                value={formulario.categoria}
                                onChange={cambiarCampo}
                                required
                            >
                                <option value="">Seleccionar categoría</option>
                                {CATEGORIAS.map((categoria) => (
                                    <option key={categoria} value={categoria}>
                                        {categoria}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="modal-articulo-campo">
                            <label htmlFor="articulo-unidad">
                                Unidad de medida <span>*</span>
                            </label>

                            <select
                                id="articulo-unidad"
                                name="unidadMedida"
                                value={formulario.unidadMedida}
                                onChange={cambiarCampo}
                                required
                            >
                                <option value="">Seleccionar unidad</option>
                                {UNIDADES_MEDIDA.map((unidad) => (
                                    <option key={unidad} value={unidad}>
                                        {unidad}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {error && (
                        <div className="modal-articulo-error" role="alert">
                            ✕ {error}
                        </div>
                    )}

                    <p className="modal-articulo-nota">
                        Los campos marcados con * son obligatorios.
                    </p>

                    <div className="modal-articulo-acciones">
                        <button
                            type="button"
                            className="modal-articulo-cancelar"
                            onClick={onCerrar}
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            className="modal-articulo-guardar"
                        >
                            Guardar artículo <span>→</span>
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

export default ModalArticulo;
