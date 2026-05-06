/**
 * AGIA — Cerebro principal
 * Asistente de Gerencia con Inteligencia Artificial
 *
 * Este módulo es el corazón de AGIA. Recibe cualquier entrada
 * (texto, voz transcrita, contenido de foto o documento) y
 * decide qué hacer con ella: responder, guardar, avisar, generar.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

class AGIACerebro {
  constructor(configuracion) {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.modelo = this.gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.configuracion = configuracion; // datos del usuario y sus frentes
    this.historial = []; // memoria de la conversación actual
  }

  /**
   * Construye el contexto completo de AGIA para este usuario.
   * Esto es lo que hace que AGIA conozca al usuario y sus frentes.
   */
  construirContexto() {
    const { usuario, frentes } = this.configuracion;

    const frentesTexto = frentes.map(f => `
    FRENTE: ${f.nombre}
    Descripción: ${f.descripcion}
    Personas clave: ${f.personas.map(p => `${p.nombre} (${p.rol})`).join(", ")}
    Temas que pertenecen acá: ${f.temas.join(", ")}
    `).join("\n");

    return `
Eres AGIA — Asistente de Gerencia con Inteligencia Artificial, desarrollado por FMC DataLab.

QUIÉN ES TU USUARIO:
Nombre: ${usuario.nombre}
Estilo de comunicación: ${usuario.estilo}
Horario preferido de resumen: ${usuario.horarioResumen}
Idioma: Español colombiano, directo y formal

TUS FRENTES (los mundos que administra tu usuario):
${frentesTexto}

TU MANERA DE SER:
- Eres conciso. Nunca des rodeos. El usuario es un ejecutivo con 50+ años de experiencia.
- Siempre identificas a qué frente pertenece cada cosa, sin preguntar si es obvio.
- Cuando algo queda pendiente de otra persona, lo registras y haces seguimiento automático.
- Antes de enviar cualquier mensaje en nombre del usuario, muestras el borrador y pides aprobación.
- Nunca mezclas información de un frente con otro.
- Cuando analizas un documento, vas directo a lo importante: cifras clave, diferencias con lo anterior, alertas.
- Si algo vence pronto, avisas con suficiente anticipación para actuar.
- Tu tono es el del propio usuario: formal, directo, sin adornos.

LO QUE PUEDES HACER:
1. ORGANIZAR: Guardar y recuperar pendientes de cada frente
2. SEGUIMIENTO: Registrar compromisos de terceros y avisar si no responden
3. ANALIZAR: Leer documentos, cotizaciones y contratos, y resumir lo importante
4. GENERAR: Redactar cartas, mensajes, resúmenes y actas
5. ALERTAR: Avisar de vencimientos con anticipación suficiente

LO QUE NUNCA HACES:
- Enviar mensajes sin aprobación explícita del usuario
- Tomar decisiones importantes sin consultar
- Mezclar información entre frentes
- Dar rodeos cuando el usuario quiere una respuesta directa

FORMATO DE TUS RESPUESTAS:
Responde siempre en JSON con esta estructura exacta:
{
  "tipo": "respuesta | pendiente | borrador | alerta | analisis",
  "frente": "nombre del frente o 'general' si aplica a todo",
  "mensaje": "lo que le dices al usuario en lenguaje natural",
  "accion": {
    "tipo": "ninguna | guardar_pendiente | crear_seguimiento | generar_borrador | registrar_alerta",
    "datos": {} 
  },
  "requiereAprobacion": false
}
    `.trim();
  }

  /**
   * Procesa cualquier entrada del usuario y devuelve la respuesta de AGIA.
   * @param {string} entrada - Lo que dijo o mandó el usuario
   * @param {string} tipoEntrada - "texto", "voz", "foto", "documento", "whatsapp"
   * @param {object} metadatos - Información adicional (nombre de archivo, etc.)
   */
  async procesar(entrada, tipoEntrada = "texto", metadatos = {}) {
    try {
      // Preparar el mensaje con contexto del tipo de entrada
      const mensajeUsuario = this._prepararMensaje(entrada, tipoEntrada, metadatos);

      // Construir el historial para que AGIA recuerde la conversación
      const historialGemini = this.historial.map(h => ({
        role: h.rol,
        parts: [{ text: h.contenido }],
      }));

      // Iniciar chat con contexto completo
      const chat = this.modelo.startChat({
        history: historialGemini,
        systemInstruction: this.construirContexto(),
        generationConfig: {
          temperature: 0.3, // Más bajo = más consistente y predecible
          maxOutputTokens: 1024,
        },
      });

      // Enviar mensaje y obtener respuesta
      const resultado = await chat.sendMessage(mensajeUsuario);
      const respuestaTexto = resultado.response.text();

      // Parsear la respuesta JSON de AGIA
      const respuesta = this._parsearRespuesta(respuestaTexto);

      // Guardar en historial
      this.historial.push({ rol: "user", contenido: mensajeUsuario });
      this.historial.push({ rol: "model", contenido: respuestaTexto });

      // Limitar historial a las últimas 20 interacciones (memoria reciente)
      if (this.historial.length > 40) {
        this.historial = this.historial.slice(-40);
      }

      return respuesta;

    } catch (error) {
      console.error("Error en el cerebro de AGIA:", error);
      return {
        tipo: "respuesta",
        frente: "general",
        mensaje: "Tuve un problema procesando eso. ¿Podés repetirlo?",
        accion: { tipo: "ninguna", datos: {} },
        requiereAprobacion: false,
        error: error.message,
      };
    }
  }

  /**
   * Prepara el mensaje según el tipo de entrada.
   */
  _prepararMensaje(entrada, tipoEntrada, metadatos) {
    const prefijos = {
      texto: "",
      voz: "[El usuario envió un mensaje de voz. Transcripción: ] ",
      foto: `[El usuario envió una foto${metadatos.nombre ? ` llamada "${metadatos.nombre}"` : ""}. Contenido extraído: ] `,
      documento: `[El usuario envió un documento${metadatos.nombre ? ` llamado "${metadatos.nombre}"` : ""}. Contenido: ] `,
      whatsapp: "[El usuario reenvió este mensaje de WhatsApp para que lo proceses: ] ",
    };

    return (prefijos[tipoEntrada] || "") + entrada;
  }

  /**
   * Parsea la respuesta JSON de AGIA.
   * Si AGIA no devuelve JSON válido, lo convierte en respuesta básica.
   */
  _parsearRespuesta(texto) {
    try {
      // Buscar JSON en la respuesta (a veces viene con texto alrededor)
      const inicio = texto.indexOf("{");
      const fin = texto.lastIndexOf("}");
      if (inicio !== -1 && fin !== -1) {
        const jsonLimpio = texto.substring(inicio, fin + 1);
        return JSON.parse(jsonLimpio);
      }
      throw new Error("No se encontró JSON en la respuesta");
    } catch {
      // Si no es JSON válido, devolver respuesta básica con el texto
      return {
        tipo: "respuesta",
        frente: "general",
        mensaje: texto,
        accion: { tipo: "ninguna", datos: {} },
        requiereAprobacion: false,
      };
    }
  }

  /**
   * Genera el resumen diario del usuario.
   * Se ejecuta automáticamente a la hora configurada.
   */
  async generarResumenDiario(pendientes, vencimientos) {
    const prompt = `
Genera el resumen diario de buenos días para el usuario.
Pendientes activos por frente: ${JSON.stringify(pendientes)}
Vencimientos próximos (7 días): ${JSON.stringify(vencimientos)}
Sé breve, directo y ordenado por urgencia.
    `;

    const respuesta = await this.modelo.generateContent(prompt);
    return respuesta.response.text();
  }

  /**
   * Limpia el historial de conversación.
   * Se ejecuta al inicio de cada sesión nueva.
   */
  limpiarHistorial() {
    this.historial = [];
  }
}

module.exports = AGIACerebro;
