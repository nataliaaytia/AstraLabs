const express = require("express");
const { autenticar, requiereRol } = require("../middleware/authMiddleware");
const rolesService = require("../services/rolesService");

const router = express.Router();

router.get("/", autenticar, requiereRol("Administradora"), async (req, res) => {
  try {
    const usuarios = await rolesService.listar();
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch(
  "/:id/rol",
  autenticar,
  requiereRol("Administradora"),
  async (req, res) => {
    const { rol } = req.body;
    try {
      const actualizado = await rolesService.cambiarRol({
        usuarioIdObjetivo: req.params.id,
        nuevoRol: rol,
        usuarioIdQueEjecuta: req.usuario.id,
      });
      res.json(actualizado);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

module.exports = router;
