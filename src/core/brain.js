/**
 * AGIA — Cerebro principal
 * Asistente de Gerencia con Inteligencia Artificial
 * FMC DataLab © 2025
 */

const { GoogleGenAI } = require("@google/genai");

class AGIACerebro {
  constructor(configuracion) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.configuracion = configuracion;
    this.historial = [];
  }

  construirContexto() {
    const { usuario, frentes } = this.configuracion;
    const frentesTexto = frentes.map(f => `
    FRENTE: ${f.nombre}
    Descripción: ${f.descripcion}
    Personas clave: ${f.personas.map(p => `${p.nombre} (${p.rol})`).join(", ")}
    Temas: ${f.temas.join(", ")}
    `).join("\n");

    return `
Eres AGIA — Asistente de Gerencia con Inteligencia Artificial, de FMC DataLab.

USUARIO: ${usuario.nombre}
Estilo: ${usuario.estilo}
Horario resumen: ${usuario.horarioResumen}
Idioma: Español colombiano, directo y formal.

FRENTES DEL USUARIO:
${frentesTexto}

REGLAS:
- Sé conciso. El usuario es ejecutivo con 50+ años de experiencia.
- Identifica siempre a qué frente pertenece cada cosa.
- Antes de enviar mensajes en su nombre, muestra el borrador.
- Nunca mezcles información entre frentes.
- Tu tono es el del usuario: formal, directo, sin rodeos.

RESPONDE SIEMPRE EN JSON:
{
  "tipo": "respuesta | pendiente | borrador | alerta | analisis",
  "frente": "nombre del frente o general",
  "mensaje": "respuesta al usuario",
  "accion": { "tipo": "ninguna | guardar_pendiente | crear_seguimiento | generar_borrador", "datos": {} },
  "requiereAprobacion": false
}
    `.trim();
  }

  async procesar(entrada, tipoEntrada = "texto", metadatos = {}) {
    try {
      const prefijos = {
        texto: "",
        voz: "[Mensaje de voz transcrito] ",
        foto: `[Foto de documento${metadatos.nombre ? ` "${metadatos.nombre}"` : ""}] `,
        documento: `[Documento${metadatos.nombre ? ` "${metadatos.nombre}"` : ""}] `,
        whatsapp: "[Mensaje reenviado de WhatsApp] ",
      };

      const mensajeUsuario = (prefijos[tipoEntrada] || "") + entrada;

      const historialFormateado = this.historial.map(h => ({
        role: h.rol === "model" ? "model" : "user",
        parts: [{ text: h.contenido }],
      }));

      const chat = this.ai.chats.create({
        model: "gemini-1.5-flash",
        history: historialFormateado,
        config: {
          systemInstruction: this.construirContexto(),
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      });

      const resultado = await chat.sendMessage({ message: mensajeUsuario });
      const respuestaTexto = resultado.text;

      const respuesta = this._parsearRespuesta(respuestaTexto);

      this.historial.push({ rol: "user", contenido: mensajeUsuario });
      this.historial.push({ rol: "model", contenido: respuestaTexto });

      if (this.historial.length > 40) {
        this.historial = this.historial.slice(-40);
      }

      return respuesta;

    } catch (error) {
      console.error("Error en cerebro AGIA:", error.message);
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

  async generarResumenDiario(pendientes, vencimientos) {
    try {
      console.log("Gemini API Key presente:", !!process.env.GEMINI_API_KEY);
      const prompt = `
Genera el resumen diario de buenos días para el usuario Carlos.
Pendientes por frente: ${JSON.stringify(pendientes)}
Vencimientos próximos (7 días): ${JSON.stringify(vencimientos)}
Sé breve, directo y ordenado por urgencia. Máximo 150 palabras.
      `.trim();

      const respuesta = await this.ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
      });

      return respuesta.text;
    } catch (error) {
      console.error("Error Gemini generarResumenDiario:", error.message);
      throw error;
    }
  }

  _parsearRespuesta(texto) {
    try {
      const inicio = texto.indexOf("{");
      const fin = texto.lastIndexOf("}");
      if (inicio !== -1 && fin !== -1) {
        return JSON.parse(texto.substring(inicio, fin + 1));
      }
      throw new Error("No JSON encontrado");
    } catch {
      return {
        tipo: "respuesta",
        frente: "general",
        mensaje: texto,
        accion: { tipo: "ninguna", datos: {} },
        requiereAprobacion: false,
      };
    }
  }

  limpiarHistorial() {
    this.historial = [];
  }
}

module.exports = AGIACerebro;
