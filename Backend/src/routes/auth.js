const express = require("express");
const authService = require("../services/authService");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const resultado = await authService.login({ email, password });
    res.json(resultado);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

module.exports = router;
