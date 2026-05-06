/**
 * AGIA — Módulo de Frentes
 *
 * Un frente es un mundo que administra el usuario: una empresa,
 * un proyecto, una propiedad. Cada frente tiene su propio contexto,
 * sus propias personas y sus propias reglas.
 */

// Base de datos en memoria (en producción esto va a Supabase)
const db = new Map();

class GestorFrentes {

  /**
   * Crear los frentes iniciales del usuario durante el onboarding.
   */
  static crear(usuarioId, frente) {
    const id = `${usuarioId}_${Date.now()}`;
    const nuevoFrente = {
      id,
      usuarioId,
      nombre: frente.nombre,
      descripcion: frente.descripcion || "",
      color: frente.color || "#1A3A5C",
      icono: frente.icono || "briefcase",
      personas: frente.personas || [],      // [{nombre, rol, whatsapp, email}]
      temas: frente.temas || [],             // palabras clave que pertenecen a este frente
      reglas: {
        tiempoSeguimientoHoras: frente.tiempoSeguimiento || 48,
        avisarVencimientoConDias: frente.diasAnticipacion || 7,
      },
      estadisticas: {
        pendientesActivos: 0,
        resueltosMes: 0,
        vencimientosProximos: 0,
      },
      creadoEn: new Date().toISOString(),
    };

    // Guardar en DB
    if (!db.has(usuarioId)) db.set(usuarioId, []);
    db.get(usuarioId).push(nuevoFrente);

    return nuevoFrente;
  }

  /**
   * Obtener todos los frentes de un usuario.
   */
  static obtenerTodos(usuarioId) {
    return db.get(usuarioId) || [];
  }

  /**
   * Obtener un frente por nombre (búsqueda flexible).
   */
  static buscarPorNombre(usuarioId, nombre) {
    const frentes = db.get(usuarioId) || [];
    const nombreLower = nombre.toLowerCase();
    return frentes.find(f =>
      f.nombre.toLowerCase().includes(nombreLower) ||
      f.temas.some(t => t.toLowerCase().includes(nombreLower))
    );
  }

  /**
   * Actualizar estadísticas de un frente.
   */
  static actualizarEstadisticas(usuarioId, frenteId, estadisticas) {
    const frentes = db.get(usuarioId) || [];
    const frente = frentes.find(f => f.id === frenteId);
    if (frente) {
      frente.estadisticas = { ...frente.estadisticas, ...estadisticas };
    }
  }

  /**
   * Agregar una persona a un frente.
   */
  static agregarPersona(usuarioId, frenteId, persona) {
    const frentes = db.get(usuarioId) || [];
    const frente = frentes.find(f => f.id === frenteId);
    if (frente) {
      frente.personas.push({
        id: Date.now().toString(),
        nombre: persona.nombre,
        rol: persona.rol,
        whatsapp: persona.whatsapp || null,
        email: persona.email || null,
        nota: persona.nota || "",
      });
    }
    return frente;
  }

  /**
   * Cargar frentes del caso piloto (el papá de Juanpa).
   * En producción esto viene del onboarding conversacional.
   */
  static cargarEjemploPiloto(usuarioId) {
    const frentesPiloto = [
      {
        nombre: "La empresa",
        descripcion: "Empresa con 80 empleados y ventas de 80 mil millones anuales",
        color: "#1A3A5C",
        icono: "building",
        temas: ["empresa", "empleados", "ventas", "gerente", "presupuesto", "reunión", "informe", "distribución"],
        personas: [
          { nombre: "Gerente General", rol: "Gerente", whatsapp: null, email: null },
        ],
        tiempoSeguimiento: 24, // horas — más estricto para temas empresariales
        diasAnticipacion: 10,
      },
      {
        nombre: "Hotel boutique",
        descripcion: "Hotel administrado a distancia con empleadas, jardineros y servicios",
        color: "#0F6E56",
        icono: "hotel",
        temas: ["hotel", "empleada", "jardinero", "huésped", "reserva", "servicio", "contrato", "fumigación", "mantenimiento"],
        personas: [
          { nombre: "Encargada hotel", rol: "Administradora", whatsapp: null, email: null },
        ],
        tiempoSeguimiento: 48,
        diasAnticipacion: 14, // contratos de personal vencen con más anticipación
      },
      {
        nombre: "Finca de recreo",
        descripcion: "Construcción grande en curso: arquitecto, maestro de obra, materiales, paisajismo",
        color: "#BA7517",
        icono: "construction",
        temas: ["finca", "construcción", "obra", "arquitecto", "maestro", "materiales", "cemento", "planos", "paisajismo", "etapa"],
        personas: [
          { nombre: "Juan", rol: "Maestro de obra", whatsapp: null, email: null },
          { nombre: "Arq. Ramírez", rol: "Arquitecto", whatsapp: null, email: null },
        ],
        tiempoSeguimiento: 24, // obra activa requiere seguimiento más rápido
        diasAnticipacion: 7,
      },
      {
        nombre: "Finca productiva",
        descripcion: "Cultivos de hortalizas y manejo de bosque nativo",
        color: "#276221",
        icono: "leaf",
        temas: ["finca productiva", "hortaliza", "cultivo", "siembra", "cosecha", "bosque", "nativo", "insumo", "abono"],
        personas: [],
        tiempoSeguimiento: 72, // ritmo más tranquilo
        diasAnticipacion: 7,
      },
    ];

    frentesPiloto.forEach(f => GestorFrentes.crear(usuarioId, f));
    return GestorFrentes.obtenerTodos(usuarioId);
  }
}

module.exports = GestorFrentes;
