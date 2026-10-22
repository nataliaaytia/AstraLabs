import { useEffect, useState } from "react";
import { DESTINOS_EXCEDENTE } from "../../data/excedentes";
import "./Excedente.css";

const FORMULARIO_INICIAL = {
    cantidad: "",
    destino: "",
    observaciones: "",
};

function ModalExcedente({ articulo, onCerrar, onGuardar }) {
    const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
    const [error, setError] = useState("");

    useEffect(() => {
        if (articulo) {
            setFormulario({ ...FORMULARIO_INICIAL });
            setError("");
        }
    }, [articulo]);

    useEffect(() => {
        if (!articulo) return;

        const manejarTecla = (evento) => {
            if (evento.key === "Escape") onCerrar();
        };

        window.addEventListener("keydown", manejarTecla);
        return () => window.removeEventListener("keydown", manejarTecla);
    }, [articulo, onCerrar]);

    if (!articulo) return null;

    const cambiarCampo = (evento) => {
        const { name, value } = evento.target;

        setFormulario((anterior) => ({ ...anterior, [name]: value }));
        setError("");
    };

    const enviarFormulario = (evento) => {
        evento.preventDefault();

        const resultado = onGuardar({
            articuloId: articulo.id,
            cantidad: Number(formulario.cantidad),
            destino: formulario.destino,
            observaciones: formulario.observaciones.trim(),
        });

        if (!resultado.exito) {
            setError(resultado.mensaje);
            return;
        }

        onCerrar();
    };

    return (
        <div
            className="modal-excedente-fondo"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onCerrar();
            }}
        >
            <section
                className="modal-excedente"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-excedente-titulo"
            >
                <div className="modal-excedente-encabezado">
                    <div>
                        <span className="modal-excedente-etiqueta">
                            ✦ EXCEDENTES
                        </span>
                        <h2 id="modal-excedente-titulo">
                            Marcar <em>excedente.</em>
                        </h2>
                        <p>
                            Registra el destino de <strong>{articulo.nombre}</strong>.
                            Aquí solo dejamos constancia, sin manejar montos.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="modal-excedente-cerrar"
                        onClick={onCerrar}
                        aria-label="Cerrar formulario"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={enviarFormulario}>
                    <div className="modal-excedente-campos-fila">
                        <div className="modal-excedente-campo">
                            <label htmlFor="excedente-cantidad">
                                Cantidad excedente ({articulo.unidadMedida}) <span>*</span>
                            </label>

                            <input
                                id="excedente-cantidad"
                                name="cantidad"
                                type="number"
                                min="0.01"
                                step="any"
                                value={formulario.cantidad}
                                onChange={cambiarCampo}
                                autoFocus
                                required
                            />
                        </div>

                        <div className="modal-excedente-campo">
                            <label htmlFor="excedente-destino">
                                Destino <span>*</span>
                            </label>

                            <select
                                id="excedente-destino"
                                name="destino"
                                value={formulario.destino}
                                onChange={cambiarCampo}
                                required
                            >
                                <option value="">Seleccionar destino</option>
                                {DESTINOS_EXCEDENTE.map((destino) => (
                                    <option key={destino} value={destino}>
                                        {destino}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="modal-excedente-campo">
                        <label htmlFor="excedente-observaciones">
                            Observaciones
                        </label>

                        <textarea
                            id="excedente-observaciones"
                            name="observaciones"
                            rows={3}
                            maxLength={250}
                            value={formulario.observaciones}
                            onChange={cambiarCampo}
                            placeholder="Ej. Se entregará a la parroquia el viernes"
                        />
                    </div>

                    {error && (
                        <div className="modal-excedente-error" role="alert">
                            ✕ {error}
                        </div>
                    )}

                    <p className="modal-excedente-nota">
                        Los campos marcados con * son obligatorios.
                    </p>

                    <div className="modal-excedente-acciones">
                        <button
                            type="button"
                            className="modal-excedente-cancelar"
                            onClick={onCerrar}
                        >
                            Cancelar
                        </button>

                        <button type="submit" className="modal-excedente-guardar">
                            Registrar excedente <span>→</span>
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

export default ModalExcedente;
