
import { useState } from "react";

import Cabecera from "./components/Cabecera/Cabecera";
import Home from "./pages/Home/Home";
import Almacen from "./pages/Almacen/Almacen";
import Login from "./pages/Login/Login";

import "./App.css";

function App() {
  const [paginaActual, setPaginaActual] = useState("home");

  const navegar = (pagina) => {
    setPaginaActual(pagina);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const mostrarPagina = () => {
    switch (paginaActual) {
      case "almacen":
        return <Almacen navegar={navegar} />;

      case "login":
        return <Login navegar={navegar} />;

      default:
        return <Home navegar={navegar} />;
    }
  };

  return (
    <div className="app">
      <Cabecera
        paginaActual={paginaActual}
        navegar={navegar}
      />

      <main className="app-contenido">
        {mostrarPagina()}
      </main>
    </div>
  );
}

export default App;
