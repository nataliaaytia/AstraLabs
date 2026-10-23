
import { useState } from "react";

import Cabecera from "./components/Cabecera/Cabecera";
import Home from "./pages/Home/Home";
import Almacen from "./pages/Almacen/Almacen";
import PanelOperativo from "./pages/Almacen/PanelOperativo";
import Login from "./pages/Login/Login";

import GestionRoles from "./pages/GestionRoles/GestionRoles";
import { USUARIOS_DEMO, ROLES } from "./data/usuariosDemo";


import Stock from "./pages/Stock/Stock";
import Salidas from "./pages/Salidas/Salidas";
import Mermas from "./pages/Mermas/Mermas";


import "./App.css";

const CLAVE_USUARIOS = "amandita_123";
const CLAVE_SESION = "callatericardo";

function cargarUsuarios() {
  try {
    const guardados = JSON.parse(
      localStorage.getItem(CLAVE_USUARIOS) || "{}"
    );

    return USUARIOS_DEMO.map((usuario) => ({
      ...usuario,
      rol: Object.values(ROLES).includes(guardados[usuario.id])
        ? guardados[usuario.id]
        : usuario.rol,
    }));
  } catch {
    return USUARIOS_DEMO;
  }
}

function App() {
  const [paginaActual, setPaginaActual] = useState("home");

  const [usuarios, setUsuarios] = useState(cargarUsuarios);

  const [sesionId, setSesionId] = useState(() => {
    return Number(localStorage.getItem(CLAVE_SESION)) || null;
  });

  const usuarioActual =
    usuarios.find((u) => u.id === sesionId) || null;

  const esAdmin = usuarioActual?.rol === ROLES.ADMIN;
  const esAlmacen = usuarioActual?.rol === ROLES.ALMACEN;
  const puedeVerAlmacen = esAdmin || esAlmacen;


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


  const iniciarSesion = (correo, contrasena) => {
    const usuario = usuarios.find(
      (u) =>
        u.correo.toLowerCase() === correo.trim().toLowerCase() &&
        u.contrasena === contrasena
    );

    if (!usuario) {
      return {
        exito: false,
        mensaje: "Correo o contraseña incorrectos.",
      };
    }

    setSesionId(usuario.id);
    localStorage.setItem(CLAVE_SESION, String(usuario.id));
    setPaginaActual("home");

    return {
      exito: true,
      mensaje: "Inicio de sesión correcto.",
    };
  };

  const cerrarSesion = () => {
    setSesionId(null);
    localStorage.removeItem(CLAVE_SESION);
    setPaginaActual("home");
  };

  const cambiarRol = (usuarioId, nuevoRol) => {
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

    const usuario = usuarios.find((u) => u.id === usuarioId);

    if (!usuario) {
      return {
        exito: false,
        mensaje: "Usuario no encontrado.",
      };
    }

    if (usuarioId === usuarioActual.id) {
      return {
        exito: false,
        mensaje: "No puedes modificar tu propio rol.",
      };
    }

    const actualizados = usuarios.map((u) =>
      u.id === usuarioId ? { ...u, rol: nuevoRol } : u
    );

    setUsuarios(actualizados);

    localStorage.setItem(
      CLAVE_USUARIOS,
      JSON.stringify(
        Object.fromEntries(
          actualizados.map((u) => [u.id, u.rol])
        )
      )
    );

    return {
      exito: true,
      mensaje: "El rol se actualizó correctamente.",
    };
  };

  const mostrarPagina = () => {
    switch (paginaActual) {

      case "almacen":
        if (esAdmin) {
          return <Almacen navegar={navegar} />;
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
