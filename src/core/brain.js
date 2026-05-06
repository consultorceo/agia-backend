/**
 * AGIA — Cerebro principal
 * Asistente de Gerencia con Inteligencia Artificial
 * FMC DataLab © 2025
 * Usa la API REST de Gemini directamente — sin SDK
 */

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";

async function llamarGemini(prompt, contexto = "") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

  const cuerpo = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  };

  if (contexto) {
    cuerpo.systemInstruction = { parts: [{ text: contexto }] };
  }

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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

    return `Eres AGIA — Asistente de Gerencia con Inteligencia Artificial, de FMC DataLab.

USUARIO: ${usuario.nombre}
Estilo: ${usuario.estilo}
Idioma: Español colombiano, directo y formal.

FRENTES DEL USUARIO:
${frentesTexto}

REGLAS:
- Sé conciso. El usuario es ejecutivo con 50+ años de experiencia.
- Identifica siempre a qué frente pertenece cada cosa.
- Antes de enviar mensajes en su nombre, muestra el borrador y pide aprobación.
- Nunca mezcles información entre frentes.
- Tu tono es el del usuario: formal, directo, sin adornos.

RESPONDE SIEMPRE EN JSON con exactamente esta estructura:
{"tipo":"respuesta","frente":"nombre del frente o general","mensaje":"tu respuesta","accion":{"tipo":"ninguna","datos":{}},"requiereAprobacion":false}`;
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

      const historialTexto = this.historial.slice(-10)
        .map(h => `${h.rol === "user" ? "Usuario" : "AGIA"}: ${h.contenido}`)
        .join("\n");

      const promptCompleto = historialTexto
        ? `Historial reciente:\n${historialTexto}\n\nNuevo mensaje: ${prefijos[tipoEntrada] || ""}${entrada}`
        : `${prefijos[tipoEntrada] || ""}${entrada}`;

      const respuestaTexto = await llamarGemini(promptCompleto, this.construirContexto());
      const respuesta = this._parsearRespuesta(respuestaTexto);

      this.historial.push({ rol: "user", contenido: entrada });
      this.historial.push({ rol: "model", contenido: respuestaTexto });
      if (this.historial.length > 20) this.historial = this.historial.slice(-20);

      return respuesta;
    } catch (error) {
      console.error("Error cerebro AGIA:", error.message);
      return {
        tipo: "respuesta", frente: "general",
        mensaje: "Tuve un problema procesando eso. ¿Podés repetirlo?",
        accion: { tipo: "ninguna", datos: {} },
        requiereAprobacion: false, error: error.message,
      };
    }
  }

  async generarResumenDiario(pendientes, vencimientos) {
    console.log("API Key presente:", !!process.env.GEMINI_API_KEY);
    const prompt = `Genera el resumen diario de buenos días para el usuario Carlos.
Pendientes por frente: ${JSON.stringify(pendientes)}
Vencimientos próximos 7 días: ${JSON.stringify(vencimientos)}
Sé breve, directo y ordenado por urgencia. Máximo 120 palabras. En español colombiano formal.`;

    return await llamarGemini(prompt);
  }

  _parsearRespuesta(texto) {
    try {
      const inicio = texto.indexOf("{");
      const fin = texto.lastIndexOf("}");
      if (inicio !== -1 && fin !== -1) return JSON.parse(texto.substring(inicio, fin + 1));
      throw new Error("Sin JSON");
    } catch {
      return { tipo: "respuesta", frente: "general", mensaje: texto, accion: { tipo: "ninguna", datos: {} }, requiereAprobacion: false };
    }
  }

  limpiarHistorial() { this.historial = []; }
}

module.exports = AGIACerebro;
