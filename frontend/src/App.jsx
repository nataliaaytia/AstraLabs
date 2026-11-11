
import { useCallback, useEffect, useState } from "react";

import Cabecera from "./components/Cabecera/Cabecera";
import Home from "./pages/Home/Home";
import Almacen from "./pages/Almacen/Almacen";
import PanelOperativo from "./pages/Almacen/PanelOperativo";
import Login from "./pages/Login/Login";

import GestionRoles from "./pages/GestionRoles/GestionRoles";
import { ROLES } from "./data/usuariosDemo";

import Stock from "./pages/Stock/Stock";
import Salidas from "./pages/Salidas/Salidas";
import Mermas from "./pages/Mermas/Mermas";

import { authApi } from "./services/authApi";
import {
  guardarSesion,
  limpiarSesion,
  obtenerToken,
  obtenerUsuarioGuardado,
  registrarAlExpirarSesion,
} from "./services/api";

import "./App.css";

function App() {
  const [paginaActual, setPaginaActual] = useState("home");

  const [usuarios, setUsuarios] = useState([]);
  const [errorUsuarios, setErrorUsuarios] = useState("");

  // La sesión vive en el navegador (token + datos del usuario) y la valida el backend.
  const [usuarioActual, setUsuarioActual] = useState(() =>
    obtenerToken() ? obtenerUsuarioGuardado() : null
  );

  const esAdmin = usuarioActual?.rol === ROLES.ADMIN;
  const esAlmacen = usuarioActual?.rol === ROLES.ALMACEN;
  const puedeVerAlmacen = esAdmin || esAlmacen;

  // Si el backend responde 401 (token vencido), se cierra la sesión.
  useEffect(() => {
    registrarAlExpirarSesion(() => {
      setUsuarioActual(null);
      setPaginaActual("login");
    });
  }, []);

  const cargarUsuarios = useCallback(async () => {
    try {
      const lista = await authApi.listarUsuarios();
      setUsuarios(lista);
      setErrorUsuarios("");
    } catch (err) {
      setErrorUsuarios(err.message);
    }
  }, []);

  useEffect(() => {
    if (paginaActual === "roles" && esAdmin) {
      cargarUsuarios();
    }
  }, [paginaActual, esAdmin, cargarUsuarios]);

  const navegar = (pagina) => {
    const permisos = {
      home: true,
      login: !usuarioActual,
      almacen: puedeVerAlmacen,
      roles: esAdmin,
      stock: puedeVerAlmacen,
      salidas: esAlmacen,
      mermas: esAlmacen,
    };

    if (!permisos[pagina]) {
      setPaginaActual("home");
      window.scrollTo(0, 0);
      return;
    }

    setPaginaActual(pagina);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const iniciarSesion = async (correo, contrasena) => {
    try {
      const { token, usuario } = await authApi.login(
        correo.trim(),
        contrasena
      );

      guardarSesion({ token, usuario });
      setUsuarioActual(usuario);
      setPaginaActual("home");

      return {
        exito: true,
        mensaje: "Inicio de sesión correcto.",
      };
    } catch (err) {
      return {
        exito: false,
        mensaje: err.message,
      };
    }
  };

  const cerrarSesion = () => {
    limpiarSesion();
    setUsuarioActual(null);
    setUsuarios([]);
    setPaginaActual("home");
  };

  const cambiarRol = async (usuarioId, nuevoRol) => {
    if (!esAdmin) {
      return {
        exito: false,
        mensaje: "No tienes permisos para asignar roles.",
      };
    }

    if (!Object.values(ROLES).includes(nuevoRol)) {
      return {
        exito: false,
        mensaje: "El rol seleccionado no existe.",
      };
    }

    if (usuarioId === usuarioActual.id) {
      return {
        exito: false,
        mensaje: "No puedes modificar tu propio rol.",
      };
    }

    try {
      await authApi.cambiarRol(usuarioId, nuevoRol);

      setUsuarios((anteriores) =>
        anteriores.map((u) =>
          u.id === usuarioId ? { ...u, rol: nuevoRol } : u
        )
      );

      return {
        exito: true,
        mensaje: "El rol se actualizó correctamente.",
      };
    } catch (err) {
      return {
        exito: false,
        mensaje: err.message,
      };
    }
  };

  const mostrarPagina = () => {
    switch (paginaActual) {

      case "almacen":
        if (esAdmin) {
          return (
            <Almacen
              navegar={navegar}
              usuarioActual={usuarioActual}
            />
          );
        }

        if (esAlmacen) {
          return <PanelOperativo navegar={navegar} />;
        }

        return <Home navegar={navegar} />;


      case "roles":
        return esAdmin ? (
          <GestionRoles
            usuarios={usuarios}
            usuarioActual={usuarioActual}
            cambiarRol={cambiarRol}
            errorCarga={errorUsuarios}
          />
        ) : (
          <Home navegar={navegar} />
        );

      case "login":
        return usuarioActual ? (
          <Home navegar={navegar} />
        ) : (
          <Login
            navegar={navegar}
            iniciarSesion={iniciarSesion}
          />
        );


      case "stock":
        return puedeVerAlmacen
          ? <Stock navegar={navegar} />
          : <Home navegar={navegar} />;

      case "salidas":
        return esAlmacen
          ? (
            <Salidas
              navegar={navegar}
              usuarioActual={usuarioActual}
            />
          )
          : <Home navegar={navegar} />;

      case "mermas":
        return esAlmacen
          ? (
            <Mermas
              navegar={navegar}
              usuarioActual={usuarioActual}
            />
          )
          : <Home navegar={navegar} />;



      default:
        return <Home navegar={navegar} />;
    }
  };

  return (
    <div className="app">

      <Cabecera
        paginaActual={paginaActual}
        navegar={navegar}
        usuarioActual={usuarioActual}
        esAdmin={esAdmin}
        puedeVerAlmacen={puedeVerAlmacen}
        cerrarSesion={cerrarSesion}
      />


      <main className="app-contenido">
        {mostrarPagina()}
      </main>
    </div>
  );
}

export default App;
