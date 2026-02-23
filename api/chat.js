const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");


// ===============================
// CARGAR PLAN DESDE data/plan.txt
// ===============================
function loadPlanText() {
  const planPath = path.join(process.cwd(), "data", "plan.txt");

  if (!fs.existsSync(planPath)) {
    return "";
  }

  return fs.readFileSync(planPath, "utf8");
}


// ===============================
// PARSEAR SECCIONES (1. TITULO)
// ===============================
function parseSections(planText) {
  const lines = planText.split(/\r?\n/);

  const sections = [];
  let current = null;

  const headerRegex = /^(\d+)\.\s+(.+)$/;

  for (const line of lines) {

    const match = line.match(headerRegex);

    if (match) {

      if (current) {
        current.content = current.content.join("\n").trim();
        sections.push(current);
      }

      current = {
        number: parseInt(match[1], 10),
        title: match[2].trim(),
        content: []
      };

    } else {

      if (current) {
        current.content.push(line);
      }

    }

  }

  if (current) {
    current.content = current.content.join("\n").trim();
    sections.push(current);
  }

  return sections;
}


// ===============================
// GENERAR INDICE
// ===============================
function buildIndex(sections) {

  let index = "📌 Índice del Plan Estratégico:\n\n";

  for (const s of sections) {
    index += `${s.number}. ${s.title}\n`;
  }

  index += `\nPodés decir:\n`;
  index += `• "Sección 3"\n`;
  index += `• "Modo recorrido"\n`;
  index += `• "Plan completo"\n`;

  return index;
}


// ===============================
// BUSCAR SECCION POR NUMERO
// ===============================
function findSection(sections, number) {
  return sections.find(s => s.number === number);
}


// ===============================
// DETECTORES
// ===============================
function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectSectionRequest(message) {

  const m = normalize(message);

  const match = m.match(/seccion\s+(\d+)/);

  if (!match) return null;

  return parseInt(match[1], 10);
}

function isIndexRequest(message) {

  const m = normalize(message);

  return (
    m.includes("indice") ||
    m.includes("índice") ||
    m.includes("menu") ||
    m.includes("menú")
  );
}

function isFullPlanRequest(message) {

  const m = normalize(message);

  return (
    m.includes("plan completo") ||
    m.includes("plan entero") ||
    m.includes("todo el plan")
  );
}

function isTourRequest(message) {

  const m = normalize(message);

  return (
    m.includes("modo recorrido") ||
    m.includes("recorrido")
  );
}

function isNextRequest(message) {

  const m = normalize(message);

  return (
    m.includes("siguiente") ||
    m.includes("continuar")
  );
}


// ===============================
// ESTADO DE RECORRIDO
// ===============================
const tourState = new Map();


// ===============================
// HANDLER PRINCIPAL
// ===============================
module.exports = async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {

    const body = req.body || {};

    const message = String(body.message || "").trim();

    const name = String(body.name || "Visitante");

    if (!message) {
      return res.status(400).json({ error: "Mensaje vacío" });
    }


    const planText = loadPlanText();

    const sections = parseSections(planText);


    // ===========================
    // RESPUESTAS DIRECTAS
    // ===========================

    // PLAN COMPLETO
    if (isFullPlanRequest(message)) {

      return res.status(200).json({
        reply:
          `Claro, ${name}.\n\n` +
          `El plan es extenso, por lo que te sugiero navegarlo por secciones.\n\n` +
          buildIndex(sections)
      });

    }


    // INDICE
    if (isIndexRequest(message)) {

      return res.status(200).json({
        reply: buildIndex(sections)
      });

    }


    // SECCION ESPECIFICA
    const sectionNumber = detectSectionRequest(message);

    if (sectionNumber !== null) {

      const section = findSection(sections, sectionNumber);

      if (!section) {
        return res.status(200).json({
          reply: `No encontré esa sección. Decime "Índice" para ver las disponibles.`
        });
      }

      tourState.set(name, sectionNumber);

      return res.status(200).json({
        reply:
          `Sección ${section.number}: ${section.title}\n\n` +
          section.content +
          `\n\nDecime "Siguiente" para continuar o "Índice" para volver al menú.`
      });

    }


    // MODO RECORRIDO
    if (isTourRequest(message)) {

      tourState.set(name, 1);

      const section = findSection(sections, 1);

      return res.status(200).json({
        reply:
          `Perfecto, ${name}. Iniciamos el recorrido.\n\n` +
          `Sección 1: ${section.title}\n\n` +
          section.content +
          `\n\nDecime "Siguiente" para continuar.`
      });

    }


    // SIGUIENTE
    if (isNextRequest(message)) {

      const current = tourState.get(name) || 1;

      const next = current + 1;

      const section = findSection(sections, next);

      if (!section) {

        tourState.delete(name);

        return res.status(200).json({
          reply: `Llegamos al final del plan.\n\nDecime "Índice" si querés volver a navegar.`
        });

      }

      tourState.set(name, next);

      return res.status(200).json({
        reply:
          `Sección ${section.number}: ${section.title}\n\n` +
          section.content +
          `\n\nDecime "Siguiente" para continuar.`
      });

    }


    // ===========================
    // RESPUESTA IA (OPENAI)
    // ===========================

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {

      return res.status(200).json({
        reply:
          `Hola ${name}.\n\n` +
          `Soy el asistente estratégico del plan de Product Owner BIT.\n\n` +
          `Podés comenzar viendo el Índice del plan escribiendo:\n` +
          `"Índice"\n`
      });

    }

    const openai = new OpenAI({ apiKey });


    const systemPrompt =
      `Sos el asistente estratégico del plan de Product Owner BIT de Martín Urtasun.\n\n` +
      `Respondé SOLO usando el contenido del plan.\n\n` +
      `Plan:\n\n${planText}`;


    const completion = await openai.chat.completions.create({

      model: "gpt-4o-mini",

      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],

      max_tokens: 800

    });


    const reply =
      completion.choices?.[0]?.message?.content ||
      "No pude generar una respuesta.";


    return res.status(200).json({
      reply
    });

  }

  catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Error interno del servidor"
    });

  }

};
