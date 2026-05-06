/**
 * AGIA — Módulo de Pendientes y Seguimiento
 *
 * Cuando algo queda abierto — una respuesta esperada, un informe
 * prometido, una cotización solicitada — AGIA lo registra y avisa
 * automáticamente si no se resuelve en el tiempo acordado.
 */

const { v4: uuidv4 } = require("uuid");

// Base en memoria (en producción va a Supabase)
const pendientesDB = new Map();
const seguimientosDB = new Map();

class GestorPendientes {

  /**
   * Crear un nuevo pendiente.
   * Un pendiente es algo que está abierto y necesita resolverse.
   */
  static crear(usuarioId, datos) {
    const pendiente = {
      id: uuidv4(),
      usuarioId,
      frenteId: datos.frenteId,
      frenteNombre: datos.frenteNombre,
      descripcion: datos.descripcion,
      responsable: datos.responsable || null, // quién debe hacer algo
      fechaLimite: datos.fechaLimite || null,
      prioridad: datos.prioridad || "normal", // urgente | normal | baja
      estado: "abierto",                      // abierto | en_seguimiento | resuelto
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
      historial: [],
    };

    if (!pendientesDB.has(usuarioId)) pendientesDB.set(usuarioId, []);
    pendientesDB.get(usuarioId).push(pendiente);

    return pendiente;
  }

  /**
   * Obtener todos los pendientes de un usuario, ordenados por urgencia.
   */
  static obtenerActivos(usuarioId) {
    const todos = pendientesDB.get(usuarioId) || [];
    const activos = todos.filter(p => p.estado !== "resuelto");

    // Ordenar: urgentes primero, luego por fecha límite
    return activos.sort((a, b) => {
      if (a.prioridad === "urgente" && b.prioridad !== "urgente") return -1;
      if (b.prioridad === "urgente" && a.prioridad !== "urgente") return 1;
      if (a.fechaLimite && b.fechaLimite) {
        return new Date(a.fechaLimite) - new Date(b.fechaLimite);
      }
      return new Date(b.creadoEn) - new Date(a.creadoEn);
    });
  }

  /**
   * Obtener pendientes de un frente específico.
   */
  static obtenerPorFrente(usuarioId, frenteNombre) {
    const activos = GestorPendientes.obtenerActivos(usuarioId);
    return activos.filter(p =>
      p.frenteNombre.toLowerCase().includes(frenteNombre.toLowerCase())
    );
  }

  /**
   * Marcar un pendiente como resuelto.
   */
  static resolver(usuarioId, pendienteId, nota = "") {
    const pendientes = pendientesDB.get(usuarioId) || [];
    const pendiente = pendientes.find(p => p.id === pendienteId);
    if (pendiente) {
      pendiente.estado = "resuelto";
      pendiente.actualizadoEn = new Date().toISOString();
      pendiente.historial.push({
        evento: "resuelto",
        nota,
        fecha: new Date().toISOString(),
      });
    }
    return pendiente;
  }

  /**
   * Generar el resumen de pendientes por frente.
   * Este es el formato que usa AGIA para el resumen diario.
   */
  static generarResumen(usuarioId) {
    const activos = GestorPendientes.obtenerActivos(usuarioId);
    const porFrente = {};

    activos.forEach(p => {
      if (!porFrente[p.frenteNombre]) {
        porFrente[p.frenteNombre] = { urgentes: [], normales: [], bajos: [] };
      }
      if (p.prioridad === "urgente") porFrente[p.frenteNombre].urgentes.push(p);
      else if (p.prioridad === "baja") porFrente[p.frenteNombre].bajos.push(p);
      else porFrente[p.frenteNombre].normales.push(p);
    });

    return porFrente;
  }
}

class GestorSeguimiento {

  /**
   * Crear un seguimiento automático.
   * Cuando alguien debe hacer algo, AGIA lo registra y avisa si no cumple.
   */
  static crear(usuarioId, datos) {
    const seguimiento = {
      id: uuidv4(),
      usuarioId,
      pendienteId: datos.pendienteId || null,
      frenteNombre: datos.frenteNombre,
      persona: datos.persona,             // a quién se le hace seguimiento
      accionEsperada: datos.accion,       // qué se espera de esa persona
      fechaLimite: datos.fechaLimite,     // cuándo debe responder/entregar
      avisarSiNoRespondeEn: datos.horas || 48, // horas antes de avisar
      estado: "activo",                   // activo | avisado | resuelto
      vecesAvisado: 0,
      creadoEn: new Date().toISOString(),
    };

    if (!seguimientosDB.has(usuarioId)) seguimientosDB.set(usuarioId, []);
    seguimientosDB.get(usuarioId).push(seguimiento);

    return seguimiento;
  }

  /**
   * Verificar qué seguimientos requieren aviso ahora.
   * Esta función se ejecuta periódicamente (cada hora).
   */
  static verificarVencidos(usuarioId) {
    const seguimientos = seguimientosDB.get(usuarioId) || [];
    const ahora = new Date();
    const vencidos = [];

    seguimientos
      .filter(s => s.estado === "activo")
      .forEach(s => {
        const limite = new Date(s.fechaLimite);
        const horasRestantes = (limite - ahora) / (1000 * 60 * 60);

        // Si ya pasó la fecha o queda menos tiempo del umbral de aviso
        if (horasRestantes <= 0 || horasRestantes <= s.avisarSiNoRespondeEn) {
          vencidos.push({
            ...s,
            horasRestantes: Math.round(horasRestantes),
            yaVencio: horasRestantes <= 0,
          });
          s.estado = "avisado";
          s.vecesAvisado++;
        }
      });

    return vencidos;
  }

  /**
   * Marcar un seguimiento como resuelto (la persona respondió o cumplió).
   */
  static resolver(usuarioId, seguimientoId) {
    const seguimientos = seguimientosDB.get(usuarioId) || [];
    const seguimiento = seguimientos.find(s => s.id === seguimientoId);
    if (seguimiento) {
      seguimiento.estado = "resuelto";
    }
    return seguimiento;
  }

  /**
   * Obtener todos los seguimientos activos.
   */
  static obtenerActivos(usuarioId) {
    const seguimientos = seguimientosDB.get(usuarioId) || [];
    return seguimientos.filter(s => s.estado === "activo" || s.estado === "avisado");
  }
}

module.exports = { GestorPendientes, GestorSeguimiento };
