/**
 * AGIA — Cerebro principal con Claude (Anthropic)
 * Asistente de Gerencia con Inteligencia Artificial
 * FMC DataLab © 2025
 */

const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

async function llamarClaude(prompt, sistema = "", historial = []) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const mensajes = [
    ...historial,
    { role: "user", content: prompt }
  ];

  const cuerpo = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: mensajes,
  };

  if (sistema) cuerpo.system = sistema;

  const res = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(cuerpo),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

class AGIACerebro {
  constructor(configuracion) {
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

    return `Eres AGIA — Asistente de Gerencia con Inteligencia Artificial, desarrollado por FMC DataLab.

USUARIO: ${usuario.nombre}
Estilo: ${usuario.estilo}
Idioma: Español colombiano, directo y formal.

FRENTES DEL USUARIO:
${frentesTexto}

REGLAS ABSOLUTAS:
- Sé conciso. El usuario tiene 50+ años de experiencia ejecutiva. No da rodeos y no los espera.
- Identifica siempre a qué frente pertenece cada mensaje, sin preguntar si es obvio.
- Antes de enviar cualquier mensaje en su nombre, muestra el borrador y pide aprobación explícita.
- Nunca mezcles información de un frente con otro.
- Tu tono es el del usuario: formal, directo, sin adornos.
- Cuando algo queda pendiente de otra persona, lo registras para hacer seguimiento.
- Si algo vence pronto, avisas con tiempo suficiente para actuar.

RESPONDE SIEMPRE EN JSON con exactamente esta estructura:
{
  "tipo": "respuesta | pendiente | borrador | alerta | analisis",
  "frente": "nombre del frente o general",
  "mensaje": "tu respuesta al usuario en lenguaje natural",
  "accion": {
    "tipo": "ninguna | guardar_pendiente | crear_seguimiento | generar_borrador | registrar_alerta",
    "datos": {}
  },
  "requiereAprobacion": false
}`;
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

      const historialFormateado = this.historial.slice(-10).map(h => ({
        role: h.rol,
        content: h.contenido,
      }));

      const respuestaTexto = await llamarClaude(
        mensajeUsuario,
        this.construirContexto(),
        historialFormateado
      );

      const respuesta = this._parsearRespuesta(respuestaTexto);

      this.historial.push({ rol: "user", contenido: mensajeUsuario });
      this.historial.push({ rol: "assistant", contenido: respuestaTexto });
      if (this.historial.length > 20) this.historial = this.historial.slice(-20);

      return respuesta;

    } catch (error) {
      console.error("Error cerebro AGIA:", error.message);
      return {
        tipo: "respuesta", frente: "general",
        mensaje: "Tuve un problema procesando eso. ¿Podés repetirlo?",
        accion: { tipo: "ninguna", datos: {} },
        requiereAprobacion: false,
        error: error.message,
      };
    }
  }

  async generarResumenDiario(pendientes, vencimientos) {
    console.log("Claude API Key presente:", !!process.env.ANTHROPIC_API_KEY);

    const prompt = `Genera el resumen diario de buenos días para el usuario ${this.configuracion.usuario.nombre}.

Pendientes activos por frente: ${JSON.stringify(pendientes)}
Vencimientos próximos (7 días): ${JSON.stringify(vencimientos)}

El resumen debe ser:
- Máximo 120 palabras
- En español colombiano formal y directo
- Ordenado por urgencia: primero lo crítico, luego lo importante
- Sin saludos largos — ir directo al punto
- Si no hay pendientes ni vencimientos, decirlo en una sola línea`;

    return await llamarClaude(prompt, "Eres AGIA, asistente ejecutivo de FMC DataLab. Responde en español colombiano, directo y formal.");
  }

  _parsearRespuesta(texto) {
    try {
      const inicio = texto.indexOf("{");
      const fin = texto.lastIndexOf("}");
      if (inicio !== -1 && fin !== -1) return JSON.parse(texto.substring(inicio, fin + 1));
      throw new Error("Sin JSON");
    } catch {
      return {
        tipo: "respuesta", frente: "general",
        mensaje: texto,
        accion: { tipo: "ninguna", datos: {} },
        requiereAprobacion: false,
      };
    }
  }

  limpiarHistorial() { this.historial = []; }
}

module.exports = AGIACerebro;
