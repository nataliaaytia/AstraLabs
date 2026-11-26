import { useEffect, useState } from "react";
import { inventarioApi } from "../../services/inventarioApi";
import "../InventarioComun.css";
import "./Donaciones.css";

const fechaLocal = () => {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
};

const FORMULARIO_INICIAL = {
  articuloId: "",
  cantidad: "",
  donanteId: "",
  fecha: fechaLocal(),
  numeroLote: "",
  fechaVencimiento: "",
};

const requiereLote = (articulo) =>
  Boolean(articulo) &&
  (articulo.es_perecedero === true || articulo.categoria === "Medicinas");

function Donaciones({ navegar, usuarioActual }) {
  const [articulos, setArticulos] = useState([]);
  const [donaciones, setDonaciones] = useState([]);
  const [donantes, setDonantes] = useState([]);
  const [formulario, setFormulario] = useState({
    ...FORMULARIO_INICIAL,
  });
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargarDatos = async () => {
    setCargando(true);

    try {
      const [lista, listaDonantes, entradas] = await Promise.all([
        inventarioApi.listarArticulos(),
        inventarioApi.listarDonantes(),
        inventarioApi.listarEntradas(6),
      ]);

      setArticulos(lista);
      setDonantes(listaDonantes);
      setDonaciones(entradas);
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: error.message,
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

  const registrarDonacion = async (evento) => {
    evento.preventDefault();

    if (guardando) return;

    setGuardando(true);
    setMensaje(null);

    try {
      const donanteSeleccionado = donantes.find(
        (d) => String(d.id) === String(formulario.donanteId),
      );

      if (!donanteSeleccionado) {
        throw new Error("Selecciona un donante registrado.");
      }

      const articuloRecibido = articulos.find(
        (a) => String(a.id) === String(formulario.articuloId),
      );

      const conLote = requiereLote(articuloRecibido);
      const numeroLote = formulario.numeroLote.trim().toUpperCase();

      if (conLote && (!numeroLote || !formulario.fechaVencimiento)) {
        throw new Error(
          "Este artículo es perecedero o medicina: indica el lote y la fecha de vencimiento.",
        );
      }

      const resultado = await inventarioApi.registrarDonacion({
        articuloId: formulario.articuloId,
        cantidad: Number(formulario.cantidad),
        donanteId: donanteSeleccionado.id,
        donante: donanteSeleccionado.nombre,
        fecha: formulario.fecha,
        usuarioId: usuarioActual?.id,
        ...(numeroLote ? { numeroLote } : {}),
        ...(formulario.fechaVencimiento
          ? { fechaVencimiento: formulario.fechaVencimiento }
          : {}),
      });

      setDonaciones((anteriores) => [
        {
          id: resultado.movimientoId,
          articulo: articuloSeleccionado?.nombre,
          donante: donanteSeleccionado.nombre,
          fecha: formulario.fecha,
          cantidad: Number(formulario.cantidad),
          numero_lote: numeroLote || null,
          fecha_vencimiento: formulario.fechaVencimiento || null,
        },
        ...anteriores,
      ]);

      setFormulario({ ...FORMULARIO_INICIAL });
      await cargarDatos();

      setMensaje({
        tipo: "exito",
        texto:
          `Donación registrada correctamente. ` +
          `Entrada registrada. Movimiento #${resultado.movimientoId}. Consulta Stock para ver el total actualizado.`,
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: error.message,
      });
    } finally {
      setGuardando(false);
    }
  };

  const articuloSeleccionado = articulos.find(
    (articulo) => String(articulo.id) === String(formulario.articuloId),
  );

  const pideLote = requiereLote(articuloSeleccionado);

  return (
    <section className="inv-pagina donaciones-pagina">
      <div className="inv-contenedor">
        <button
          type="button"
          className="inv-volver"
          onClick={() => navegar("home")}
        >
          ← Volver al inicio
        </button>

        <div className="donaciones-gestion-donantes">
          <button type="button" onClick={() => navegar("donantes")}>
            ♡ Gestionar donantes
          </button>
        </div>

        <div className="donaciones-encabezado">
          <span className="inv-etiqueta">✦ CASA AMANDITA · DONACIONES</span>

          <h1 className="inv-titulo">
            Registrar <em>donación.</em>
          </h1>

          <p className="inv-descripcion">
            Cada aporte nos ayuda a cuidar a quienes más queremos. Registremos
            con cariño los artículos que recibimos.
          </p>
        </div>

        <div className="donaciones-distribucion">
          <div className="inv-tarjeta">
            <div className="donaciones-tarjeta-titulo">
              <span className="donaciones-icono">♡</span>
              <div>
                <h2>Nueva donación</h2>
                <p>Completa los datos de la entrada.</p>
              </div>
            </div>

            {mensaje && (
              <div className={`inv-mensaje ${mensaje.tipo}`} role="status">
                {mensaje.tipo === "exito" ? "✓" : "✕"} {mensaje.texto}
              </div>
            )}

            <form className="inv-formulario" onSubmit={registrarDonacion}>
              <div className="inv-campo inv-ancho">
                <label htmlFor="donacion-articulo">Artículo recibido *</label>

                <select
                  id="donacion-articulo"
                  name="articuloId"
                  value={formulario.articuloId}
                  onChange={cambiarCampo}
                  required
                  disabled={cargando}
                >
                  <option value="">Seleccionar artículo</option>

                  {articulos.map((articulo) => (
                    <option key={articulo.id} value={articulo.id}>
                      {articulo.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {articuloSeleccionado && (
                <div className="donaciones-stock inv-ancho">
                  <span>Existencias actuales</span>
                  <strong>
                    {articuloSeleccionado.stock_actual}{" "}
                    {articuloSeleccionado.unidad_medida}
                  </strong>
                </div>
              )}

              <div className="inv-campo">
                <label htmlFor="donacion-cantidad">Cantidad recibida *</label>

                <input
                  id="donacion-cantidad"
                  type="number"
                  name="cantidad"
                  min="0.01"
                  step="any"
                  value={formulario.cantidad}
                  onChange={cambiarCampo}
                  placeholder="Ej. 10"
                  required
                />
              </div>

              <div className="inv-campo">
                <label htmlFor="donacion-fecha">Fecha de recepción *</label>

                <input
                  id="donacion-fecha"
                  type="date"
                  name="fecha"
                  value={formulario.fecha}
                  onChange={cambiarCampo}
                  max={fechaLocal()}
                  required
                />
              </div>

              {pideLote && (
                <>
                  <div className="donaciones-perecedero inv-ancho">
                    <span>◷</span>
                    <p>
                      {articuloSeleccionado.categoria === "Medicinas"
                        ? "Este medicamento necesita lote y fecha de vencimiento para poder rastrearlo."
                        : "Este alimento es perecedero. Indica su lote y fecha de vencimiento."}
                    </p>
                  </div>

                  <div className="inv-campo">
                    <label htmlFor="donacion-lote">Número de lote *</label>

                    <input
                      id="donacion-lote"
                      name="numeroLote"
                      value={formulario.numeroLote}
                      onChange={cambiarCampo}
                      placeholder="Ej. LCH-024"
                      maxLength={30}
                      required
                    />
                  </div>

                  <div className="inv-campo">
                    <label htmlFor="donacion-vencimiento">
                      Fecha de vencimiento *
                    </label>

                    <input
                      id="donacion-vencimiento"
                      type="date"
                      name="fechaVencimiento"
                      value={formulario.fechaVencimiento}
                      onChange={cambiarCampo}
                      required
                    />
                  </div>
                </>
              )}

              <div className="inv-campo inv-ancho">
                <label htmlFor="donacion-donante">
                  Donante o empresa benefactora *
                </label>

                <select
                  id="donacion-donante"
                  name="donanteId"
                  value={formulario.donanteId}
                  onChange={cambiarCampo}
                  required
                >
                  <option value="">Seleccionar donante registrado</option>

                  {donantes.map((donante) => (
                    <option key={donante.id} value={donante.id}>
                      {donante.nombre}
                      {donante.tipo === "empresa" ? " · Empresa" : " · Persona"}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="donaciones-registrar-donante"
                  onClick={() => navegar("donantes")}
                >
                  ＋ Registrar nuevo donante
                </button>
              </div>

              <div className="donaciones-aviso inv-ancho">
                <span>✦</span>
                <p>
                  Al registrar esta donación, la cantidad recibida se sumará
                  automáticamente al stock del artículo.
                </p>
              </div>

              <div className="inv-acciones">
                <button
                  type="submit"
                  className="inv-boton"
                  disabled={guardando || cargando || articulos.length === 0}
                >
                  {guardando ? "Registrando..." : "Registrar donación →"}
                </button>
              </div>
            </form>
          </div>

          <aside className="donaciones-lateral">
            <div className="donaciones-lateral-cabecera">
              <span>✦ HISTORIAL</span>
              <h2>Últimas donaciones</h2>
              <p>Entradas registradas recientemente.</p>
            </div>

            {donaciones.length === 0 ? (
              <div className="donaciones-sin-registros">
                ♡<p>Aún no se registraron donaciones en esta sesión.</p>
              </div>
            ) : (
              <div className="donaciones-lista">
                {donaciones.slice(0, 6).map((donacion) => (
                  <div className="donaciones-registro" key={donacion.id}>
                    <div className="donaciones-registro-icono">+</div>

                    <div>
                      <strong>{donacion.articulo}</strong>
                      <p>{donacion.donante}</p>
                      <small>{donacion.fecha}</small>

                      {donacion.numero_lote && (
                        <span className="donaciones-lote">
                          Lote {donacion.numero_lote}
                          {donacion.fecha_vencimiento &&
                            ` · vence ${donacion.fecha_vencimiento}`}
                        </span>
                      )}
                    </div>

                    <span className="donaciones-cantidad">
                      +{donacion.cantidad}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

export default Donaciones;
