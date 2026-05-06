/**
 * AGIA — Primera prueba real con Gemini
 * Simula una conversación real del papá con el asistente
 */

require("dotenv").config();
const AGIACerebro = require("./src/core/brain");
const GestorFrentes = require("./src/modules/frentes");

const USUARIO = "carlos_piloto";

async function probar() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║   AGIA — Primera prueba con Gemini     ║");
  console.log("╚════════════════════════════════════════╝\n");

  // Cargar los frentes del piloto
  const frentes = GestorFrentes.cargarEjemploPiloto(USUARIO);

  // Crear el cerebro con la configuración del papá
  const agia = new AGIACerebro({
    usuario: {
      nombre: "Carlos",
      estilo: "formal, directo, sin rodeos. Ejecutivo con 50 años de experiencia.",
      horarioResumen: "7:00 am",
    },
    frentes,
  });

  // Mensajes de prueba — como los mandaría el papá
  const pruebas = [
    {
      descripcion: "Pregunta sobre pendientes del día",
      tipo: "texto",
      mensaje: "¿Qué tengo pendiente hoy en la finca de recreo?",
    },
    {
      descripcion: "Instrucción de seguimiento",
      tipo: "texto",
      mensaje: "Juan el maestro de obra lleva 3 días sin mandar el informe de avance. Necesito que me ayudes a hacerle seguimiento.",
    },
    {
      descripcion: "Documento reenviado de WhatsApp",
      tipo: "whatsapp",
      mensaje: "El arquitecto me mandó esto: 'Don Carlos, le envío la cotización de la segunda etapa. Son $48 millones por materiales y mano de obra. Quedo pendiente de su aprobación. Arq. Ramírez'",
    },
    {
      descripcion: "Voz — instrucción rápida",
      tipo: "voz",
      mensaje: "Necesito que redactes un mensaje para el gerente de la empresa diciéndole que la reunión del viernes se pasa para el lunes a las diez de la mañana.",
    },
  ];

  // Ejecutar cada prueba
  for (let i = 0; i < pruebas.length; i++) {
    const p = pruebas[i];
    console.log(`── Prueba ${i + 1}: ${p.descripcion}`);
    console.log(`   Carlos dice (${p.tipo}): "${p.mensaje.substring(0, 80)}${p.mensaje.length > 80 ? '...' : ''}"`);
    console.log();

    try {
      const respuesta = await agia.procesar(p.mensaje, p.tipo);

      console.log(`   AGIA responde:`);
      console.log(`   Frente detectado: ${respuesta.frente}`);
      console.log(`   Tipo de respuesta: ${respuesta.tipo}`);
      console.log(`   Mensaje: "${respuesta.mensaje}"`);

      if (respuesta.accion?.tipo !== "ninguna") {
        console.log(`   Acción: ${respuesta.accion.tipo}`);
      }
      if (respuesta.requiereAprobacion) {
        console.log(`   ⚠  Requiere aprobación del usuario antes de ejecutar`);
      }

    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }

    console.log(`\n${"─".repeat(60)}\n`);

    // Pausa entre mensajes para no saturar la API
    if (i < pruebas.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log("╔════════════════════════════════════════╗");
  console.log("║   AGIA está funcionando con Gemini     ║");
  console.log("╚════════════════════════════════════════╝\n");
}

probar().catch(console.error);
