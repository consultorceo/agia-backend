/**
 * AGIA — Módulo de Alertas
 *
 * AGIA lleva un calendario invisible de contratos, pagos,
 * renovaciones y plazos. Avisa con tiempo suficiente para actuar.
 */

const { v4: uuidv4 } = require("uuid");

const alertasDB = new Map();

class GestorAlertas {

  /**
   * Registrar un vencimiento o fecha importante.
   */
  static crear(usuarioId, datos) {
    const alerta = {
      id: uuidv4(),
      usuarioId,
      frenteNombre: datos.frenteNombre,
      titulo: datos.titulo,
      descripcion: datos.descripcion || "",
      fechaVencimiento: datos.fechaVencimiento,
      diasAnticipacion: datos.diasAnticipacion || 7,
      tipo: datos.tipo || "vencimiento", // vencimiento | pago | reunion | entrega | otro
      estado: "activa",
      avisosEnviados: [],
      creadoEn: new Date().toISOString(),
    };

    if (!alertasDB.has(usuarioId)) alertasDB.set(usuarioId, []);
    alertasDB.get(usuarioId).push(alerta);

    return alerta;
  }

  /**
   * Obtener alertas próximas (próximos N días).
   */
  static obtenerProximas(usuarioId, dias = 30) {
    const alertas = alertasDB.get(usuarioId) || [];
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);

    return alertas
      .filter(a => {
        const fecha = new Date(a.fechaVencimiento);
        return a.estado === "activa" && fecha >= ahora && fecha <= limite;
      })
      .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))
      .map(a => ({
        ...a,
        diasRestantes: Math.ceil(
          (new Date(a.fechaVencimiento) - ahora) / (1000 * 60 * 60 * 24)
        ),
      }));
  }

  /**
   * Verificar qué alertas necesitan notificación ahora.
   */
  static verificarQueNecesitanAviso(usuarioId) {
    const alertas = alertasDB.get(usuarioId) || [];
    const ahora = new Date();
    const paraAvisar = [];

    alertas
      .filter(a => a.estado === "activa")
      .forEach(a => {
        const fecha = new Date(a.fechaVencimiento);
        const diasRestantes = Math.ceil((fecha - ahora) / (1000 * 60 * 60 * 24));

        // Avisar si quedan exactamente los días de anticipación configurados
        // o si ya venció (días negativos)
        if (diasRestantes <= a.diasAnticipacion && diasRestantes >= -7) {
          const yaAvise = a.avisosEnviados.some(av =>
            Math.abs(new Date(av) - ahora) < 24 * 60 * 60 * 1000 // avisado hoy
          );
          if (!yaAvise) {
            paraAvisar.push({ ...a, diasRestantes });
            a.avisosEnviados.push(ahora.toISOString());
          }
        }
      });

    return paraAvisar;
  }

  /**
   * Marcar una alerta como atendida.
   */
  static resolver(usuarioId, alertaId) {
    const alertas = alertasDB.get(usuarioId) || [];
    const alerta = alertas.find(a => a.id === alertaId);
    if (alerta) alerta.estado = "resuelta";
    return alerta;
  }

  /**
   * Cargar alertas de ejemplo para el piloto.
   */
  static cargarEjemploPiloto(usuarioId) {
    const hoy = new Date();
    const en5Dias = new Date(hoy.getTime() + 5 * 24 * 60 * 60 * 1000);
    const en6Dias = new Date(hoy.getTime() + 6 * 24 * 60 * 60 * 1000);
    const en15Dias = new Date(hoy.getTime() + 15 * 24 * 60 * 60 * 1000);

    const ejemplos = [
      {
        frenteNombre: "Hotel boutique",
        titulo: "Vence contrato de fumigación",
        descripcion: "Fumigaciones Rápido — requiere renovación o cambio de proveedor",
        fechaVencimiento: en5Dias.toISOString(),
        diasAnticipacion: 7,
        tipo: "vencimiento",
      },
      {
        frenteNombre: "Finca de recreo",
        titulo: "Vence contrato maestro de obra",
        descripcion: "Juan — maestro de obra. Verificar si se renueva o se liquida",
        fechaVencimiento: en6Dias.toISOString(),
        diasAnticipacion: 10,
        tipo: "vencimiento",
      },
      {
        frenteNombre: "Hotel boutique",
        titulo: "Pago seguridad social empleadas",
        descripcion: "Pago mensual seguridad social personal del hotel",
        fechaVencimiento: en15Dias.toISOString(),
        diasAnticipacion: 5,
        tipo: "pago",
      },
    ];

    ejemplos.forEach(e => GestorAlertas.crear(usuarioId, e));
    return GestorAlertas.obtenerProximas(usuarioId);
  }
}

module.exports = GestorAlertas;
