/**
 * AGIA — Prueba del backend
 * Verifica que todos los módulos funcionen correctamente
 * sin necesitar la clave de Gemini.
 */

const GestorFrentes = require("./src/modules/frentes");
const { GestorPendientes, GestorSeguimiento } = require("./src/modules/pendientes");
const GestorAlertas = require("./src/modules/alertas");

const USUARIO_PRUEBA = "prueba_001";
const OK = "✓";
const FALLO = "✗";

let pasaron = 0;
let fallaron = 0;

function probar(nombre, fn) {
  try {
    fn();
    console.log(`  ${OK}  ${nombre}`);
    pasaron++;
  } catch (e) {
    console.log(`  ${FALLO}  ${nombre} — ${e.message}`);
    fallaron++;
  }
}

console.log("\n══════════════════════════════════════════");
console.log("  AGIA — Prueba de módulos del backend");
console.log("══════════════════════════════════════════\n");

// ── Módulo de Frentes ────────────────────────────────────
console.log("Módulo de Frentes:");

probar("Carga el caso piloto correctamente", () => {
  const frentes = GestorFrentes.cargarEjemploPiloto(USUARIO_PRUEBA);
  if (frentes.length < 4) throw new Error(`Solo ${frentes.length} frentes cargados`);
});

probar("Obtiene todos los frentes del usuario", () => {
  const frentes = GestorFrentes.obtenerTodos(USUARIO_PRUEBA);
  if (frentes.length === 0) throw new Error("No hay frentes");
});

probar("Busca un frente por nombre parcial", () => {
  const frente = GestorFrentes.buscarPorNombre(USUARIO_PRUEBA, "hotel");
  if (!frente) throw new Error("No encontró el hotel");
  if (!frente.nombre.toLowerCase().includes("hotel")) throw new Error("Encontró el frente equivocado");
});

probar("Busca un frente por tema", () => {
  const frente = GestorFrentes.buscarPorNombre(USUARIO_PRUEBA, "maestro");
  if (!frente) throw new Error("No encontró frente por tema 'maestro'");
});

// ── Módulo de Pendientes ─────────────────────────────────
console.log("\nMódulo de Pendientes:");

probar("Crea un pendiente urgente", () => {
  const p = GestorPendientes.crear(USUARIO_PRUEBA, {
    frenteNombre: "Finca de recreo",
    descripcion: "Informe de avance semana 18 pendiente",
    responsable: "Juan el maestro de obra",
    prioridad: "urgente",
    fechaLimite: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (!p.id) throw new Error("Pendiente sin ID");
  if (p.estado !== "abierto") throw new Error("Estado incorrecto");
});

probar("Crea un pendiente normal", () => {
  GestorPendientes.crear(USUARIO_PRUEBA, {
    frenteNombre: "La empresa",
    descripcion: "Revisión presupuesto tercer trimestre",
    prioridad: "normal",
  });
});

probar("Obtiene pendientes activos ordenados por urgencia", () => {
  const pendientes = GestorPendientes.obtenerActivos(USUARIO_PRUEBA);
  if (pendientes.length < 2) throw new Error("Menos pendientes de los esperados");
  if (pendientes[0].prioridad !== "urgente") throw new Error("El urgente no está primero");
});

probar("Filtra pendientes por frente", () => {
  const pendientes = GestorPendientes.obtenerPorFrente(USUARIO_PRUEBA, "empresa");
  if (pendientes.length === 0) throw new Error("No encontró pendientes de la empresa");
});

probar("Genera resumen por frente", () => {
  const resumen = GestorPendientes.generarResumen(USUARIO_PRUEBA);
  if (!resumen["Finca de recreo"]) throw new Error("No hay resumen de Finca de recreo");
  if (!resumen["La empresa"]) throw new Error("No hay resumen de La empresa");
});

probar("Resuelve un pendiente", () => {
  const pendientes = GestorPendientes.obtenerActivos(USUARIO_PRUEBA);
  const pendiente = pendientes[pendientes.length - 1];
  const resuelto = GestorPendientes.resolver(USUARIO_PRUEBA, pendiente.id, "Resuelto en prueba");
  if (resuelto.estado !== "resuelto") throw new Error("No cambió a resuelto");
});

// ── Módulo de Seguimiento ────────────────────────────────
console.log("\nMódulo de Seguimiento:");

probar("Crea un seguimiento automático", () => {
  const s = GestorSeguimiento.crear(USUARIO_PRUEBA, {
    frenteNombre: "Finca de recreo",
    persona: "Arq. Ramírez",
    accion: "Enviar cotización segunda etapa",
    fechaLimite: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hora
    horas: 2,
  });
  if (!s.id) throw new Error("Seguimiento sin ID");
});

probar("Detecta seguimientos que necesitan aviso", () => {
  const vencidos = GestorSeguimiento.verificarVencidos(USUARIO_PRUEBA);
  // El seguimiento que creamos vence en 1h pero el umbral es 2h → debe aparecer
  if (vencidos.length === 0) throw new Error("No detectó el seguimiento vencido");
});

probar("Obtiene seguimientos activos", () => {
  const activos = GestorSeguimiento.obtenerActivos(USUARIO_PRUEBA);
  if (activos.length === 0) throw new Error("No hay seguimientos activos");
});

// ── Módulo de Alertas ────────────────────────────────────
console.log("\nMódulo de Alertas:");

probar("Carga alertas del piloto", () => {
  const alertas = GestorAlertas.cargarEjemploPiloto(USUARIO_PRUEBA);
  if (alertas.length < 2) throw new Error("Pocas alertas cargadas");
});

probar("Obtiene alertas próximas de los próximos 30 días", () => {
  const alertas = GestorAlertas.obtenerProximas(USUARIO_PRUEBA, 30);
  if (alertas.length === 0) throw new Error("No hay alertas próximas");
});

probar("Las alertas tienen días restantes calculados", () => {
  const alertas = GestorAlertas.obtenerProximas(USUARIO_PRUEBA, 30);
  if (typeof alertas[0].diasRestantes !== "number") throw new Error("Falta diasRestantes");
});

probar("Detecta alertas que necesitan aviso", () => {
  const paraAvisar = GestorAlertas.verificarQueNecesitanAviso(USUARIO_PRUEBA);
  // Las alertas del piloto están dentro del rango de anticipación → deben aparecer
  if (paraAvisar.length === 0) throw new Error("No detectó alertas para avisar");
});

// ── Resultado final ──────────────────────────────────────
console.log("\n══════════════════════════════════════════");
console.log(`  Resultado: ${pasaron} pasaron  |  ${fallaron} fallaron`);
if (fallaron === 0) {
  console.log("  Backend de AGIA listo para conectar con Gemini");
} else {
  console.log("  Hay errores que corregir antes de continuar");
}
console.log("══════════════════════════════════════════\n");
