/**
 * AGIA — Servidor principal
 * Asistente de Gerencia con Inteligencia Artificial
 * FMC DataLab © 2025
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rutas = require("./src/api/rutas");

const app = express();
const PUERTO = process.env.PORT || 3000;

// ── Seguridad y configuración ────────────────────────────
app.use(cors({ origin: "*", methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] }));
app.options("*", cors());
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Registro de peticiones ───────────────────────────────
app.use((req, res, next) => {
  const ahora = new Date().toLocaleTimeString("es-CO");
  console.log(`[${ahora}] ${req.method} ${req.path}`);
  next();
});

// ── Rutas de AGIA ────────────────────────────────────────
app.use("/agia", rutas);

// ── Ruta raíz ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Manejo de rutas no encontradas ───────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada", ruta: req.path });
});

// ── Manejo de errores globales ───────────────────────────
app.use((error, req, res, next) => {
  console.error("Error no manejado:", error);
  res.status(500).json({ error: "Error interno del servidor" });
});

// ── Arrancar (solo cuando se ejecuta directamente, no en Vercel) ──
if (require.main === module) {
  app.listen(PUERTO, () => {
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║  AGIA — Asistente de Gerencia con IA   ║");
    console.log("║  FMC DataLab © 2025                    ║");
    console.log(`╠════════════════════════════════════════╣`);
    console.log(`║  Servidor activo en puerto ${PUERTO}         ║`);
    console.log(`║  Rutas disponibles en /agia/...        ║`);
    console.log("╚════════════════════════════════════════╝\n");
  });
}

module.exports = app;

// Servir archivos estáticos (interfaz de prueba)
const path = require("path");
app.use(express.static(path.join(__dirname, "public")));
