/**
 * AGIA — API REST
 *
 * Estas son las rutas que la app móvil llama para hablar
 * con el cerebro de AGIA.
 */

const express = require("express");
const multer = require("multer");
const AGIACerebro = require("../core/brain");
const GestorFrentes = require("../modules/frentes");
const { GestorPendientes, GestorSeguimiento } = require("../modules/pendientes");
const GestorAlertas = require("../modules/alertas");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Cerebros activos por usuario (en producción se maneja con sesiones)
const cerebros = new Map();

/**
 * Obtener o crear el cerebro de AGIA para un usuario.
 */
function obtenerCerebro(usuarioId) {
  if (!cerebros.has(usuarioId)) {
    // Cargar configuración del usuario
    const frentes = GestorFrentes.obtenerTodos(usuarioId);

    const configuracion = {
      usuario: {
        nombre: "Horacio",                  // viene del perfil del usuario
        estilo: "formal, directo, sin rodeos",
        horarioResumen: "7:00 am",
      },
      frentes: frentes.length > 0 ? frentes : GestorFrentes.cargarEjemploPiloto(usuarioId),
    };

    cerebros.set(usuarioId, new AGIACerebro(configuracion));
  }
  return cerebros.get(usuarioId);
}

// ═══════════════════════════════════════════════════════════
// RUTAS PRINCIPALES
// ═══════════════════════════════════════════════════════════

/**
 * POST /mensaje
 * El usuario le envía un mensaje de texto a AGIA.
 */
router.post("/mensaje", async (req, res) => {
  try {
    const { usuarioId = "piloto_001", mensaje } = req.body;

    if (!mensaje?.trim()) {
      return res.status(400).json({ error: "El mensaje no puede estar vacío" });
    }

    const cerebro = obtenerCerebro(usuarioId);
    const respuesta = await cerebro.procesar(mensaje, "texto");

    // Si AGIA detectó un pendiente, guardarlo
    if (respuesta.accion?.tipo === "guardar_pendiente" && respuesta.accion.datos) {
      GestorPendientes.crear(usuarioId, {
        ...respuesta.accion.datos,
        frenteNombre: respuesta.frente,
      });
    }

    // Si AGIA detectó algo que necesita seguimiento, crearlo
    if (respuesta.accion?.tipo === "crear_seguimiento" && respuesta.accion.datos) {
      GestorSeguimiento.crear(usuarioId, {
        ...respuesta.accion.datos,
        frenteNombre: respuesta.frente,
      });
    }

    res.json({ ok: true, respuesta });

  } catch (error) {
    console.error("Error en /mensaje:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * POST /voz
 * El usuario manda una nota de voz. Primero se transcribe, luego se procesa.
 * En esta versión, la transcripción llega ya hecha desde la app móvil.
 */
router.post("/voz", async (req, res) => {
  try {
    const { usuarioId = "piloto_001", transcripcion } = req.body;

    if (!transcripcion?.trim()) {
      return res.status(400).json({ error: "La transcripción no puede estar vacía" });
    }

    const cerebro = obtenerCerebro(usuarioId);
    const respuesta = await cerebro.procesar(transcripcion, "voz");

    res.json({ ok: true, respuesta });

  } catch (error) {
    console.error("Error en /voz:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * POST /documento
 * El usuario manda una foto o un archivo para analizar.
 * El texto extraído del documento llega desde la app móvil.
 */
router.post("/documento", async (req, res) => {
  try {
    const { usuarioId = "piloto_001", contenido, nombreArchivo, tipo = "documento" } = req.body;

    if (!contenido?.trim()) {
      return res.status(400).json({ error: "El contenido del documento no puede estar vacío" });
    }

    const cerebro = obtenerCerebro(usuarioId);
    const respuesta = await cerebro.procesar(
      contenido,
      tipo, // "foto" o "documento"
      { nombre: nombreArchivo }
    );

    res.json({ ok: true, respuesta });

  } catch (error) {
    console.error("Error en /documento:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * POST /whatsapp
 * El usuario reenvió un mensaje de WhatsApp para que AGIA lo procese.
 */
router.post("/whatsapp", async (req, res) => {
  try {
    const { usuarioId = "piloto_001", mensajeWhatsapp, remitente } = req.body;

    if (!mensajeWhatsapp?.trim()) {
      return res.status(400).json({ error: "El mensaje de WhatsApp no puede estar vacío" });
    }

    const entrada = remitente
      ? `Mensaje de ${remitente}: ${mensajeWhatsapp}`
      : mensajeWhatsapp;

    const cerebro = obtenerCerebro(usuarioId);
    const respuesta = await cerebro.procesar(entrada, "whatsapp");

    res.json({ ok: true, respuesta });

  } catch (error) {
    console.error("Error en /whatsapp:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ═══════════════════════════════════════════════════════════
// RUTAS DE DATOS
// ═══════════════════════════════════════════════════════════

/**
 * GET /resumen-diario
 * El resumen que AGIA genera cada mañana.
 */
router.get("/resumen-diario", async (req, res) => {
  try {
    const { usuarioId = "piloto_001" } = req.query;
    const pendientes = GestorPendientes.generarResumen(usuarioId);
    const vencimientos = GestorAlertas.obtenerProximas(usuarioId, 7);
    const cerebro = obtenerCerebro(usuarioId);
    const resumen = await cerebro.generarResumenDiario(pendientes, vencimientos);

    res.json({ ok: true, resumen, pendientes, vencimientos });

  } catch (error) {
    console.error("Error resumen-diario:", error.message, error.stack);
    res.status(500).json({ error: "Error generando resumen", detalle: error.message });
  }
});

/**
 * GET /frentes
 * Todos los frentes del usuario con sus estadísticas.
 */
router.get("/frentes", (req, res) => {
  const { usuarioId = "piloto_001" } = req.query;
  let frentes = GestorFrentes.obtenerTodos(usuarioId);

  if (frentes.length === 0) {
    frentes = GestorFrentes.cargarEjemploPiloto(usuarioId);
  }

  // Enriquecer con conteo de pendientes
  const resumenPendientes = GestorPendientes.generarResumen(usuarioId);
  const frentesEnriquecidos = frentes.map(f => ({
    ...f,
    pendientes: {
      urgentes: (resumenPendientes[f.nombre]?.urgentes || []).length,
      normales: (resumenPendientes[f.nombre]?.normales || []).length,
      total: (
        (resumenPendientes[f.nombre]?.urgentes || []).length +
        (resumenPendientes[f.nombre]?.normales || []).length +
        (resumenPendientes[f.nombre]?.bajos || []).length
      ),
    },
  }));

  res.json({ ok: true, frentes: frentesEnriquecidos });
});

/**
 * GET /pendientes
 * Todos los pendientes activos, opcionalmente filtrados por frente.
 */
router.get("/pendientes", (req, res) => {
  const { usuarioId = "piloto_001", frente } = req.query;
  const pendientes = frente
    ? GestorPendientes.obtenerPorFrente(usuarioId, frente)
    : GestorPendientes.obtenerActivos(usuarioId);

  res.json({ ok: true, pendientes, total: pendientes.length });
});

/**
 * GET /alertas
 * Alertas de vencimientos próximos.
 */
router.get("/alertas", (req, res) => {
  const { usuarioId = "piloto_001" } = req.query;
  let alertas = GestorAlertas.obtenerProximas(usuarioId, 30);

  if (alertas.length === 0) {
    GestorAlertas.cargarEjemploPiloto(usuarioId);
    alertas = GestorAlertas.obtenerProximas(usuarioId, 30);
  }

  res.json({ ok: true, alertas, total: alertas.length });
});

/**
 * PATCH /pendientes/:id/resolver
 * Marcar un pendiente como resuelto.
 */
router.patch("/pendientes/:id/resolver", (req, res) => {
  const { usuarioId = "piloto_001", nota = "" } = req.body;
  const pendiente = GestorPendientes.resolver(usuarioId, req.params.id, nota);
  res.json({ ok: true, pendiente });
});

/**
 * GET /estado
 * Estado del servidor — para verificar que AGIA está funcionando.
 */
router.get("/estado", (req, res) => {
  res.json({
    ok: true,
    servicio: "AGIA — Asistente de Gerencia con Inteligencia Artificial",
    version: "1.0.0",
    desarrollador: "FMC DataLab",
    estado: "activo",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
