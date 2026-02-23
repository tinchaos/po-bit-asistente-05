const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

// ===============
// Helpers Plan
// ===============
function loadPlanText() {
  const planPath = path.join(process.cwd(), "data", "plan.txt");
  return fs.readFileSync(planPath, "utf8");
}

// Detecta secciones por encabezados tipo "1. TITULO"
function parseSections(planText) {
  const lines = planText.split(/\r?\n/);

  const sections = [];
  let current = null;

  const headerRegex = /^(\d+)\.\s+(.+?)\s*$/;

  for (const line of lines) {
    const m = line.match(headerRegex);
    if (m) {
      // cerrar sección anterior
      if (current) {
        current.content = current.content.join("\n").trim();
        sections.push(current);
      }
      // crear nueva
      current = {
        number: parseInt(m[1], 10),
        title: m[2].trim(),
        content: []
      };
    } else {
      if (!current) {
        // texto antes de la sección 1 (si existe)
        current = { number: 0, title: "INTRO", content: [] };
      }
      current.content.push(line);
    }
  }

  if (current) {
    current.content = current.content.join("\n").trim();
    sections.push(current);
  }

  // Si existe intro 0 vacía, la filtramos
  return sections.filter(s => !(s.number === 0 && !s.content));
}

function buildIndex(sections) {
  const main = sections.filter(s => s.number > 0);
  const lines = main.map(s => `${s.number}. ${s.title}`);
  return lines.join("\n");
}

function getSectionByNumber(sections, n) {
  return sections.find(s => s.number === n);
}

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// intents
function isAskIndex(msg) {
  const m = normalize(msg);
  return m.includes("indice") || m.includes("índice") || m.includes("index") || m.includes("menu") || m.includes("menú");
}

function isAskFullPlan(msg) {
  const m = normalize(msg);
  return (
    m.includes("plan completo") ||
    m.includes("plan entero") ||
    m.includes("todo el plan") ||
    m.includes("mostrame el plan") ||
    m.includes("mostrar el plan")
  );
}

// captura "seccion 3" / "sección 3" / "ver 3"
function extractSectionNumber(msg) {
  const m = normalize(msg);
  const regex = /(seccion|sección|ver|mostrar|abrir|capitulo|capítulo)\s+(\d{1,2})/;
  const match = m.match(regex);
  if (!match) return null;
  const n = parseInt(match[2], 10);
  return Number.isFinite(n) ? n : null;
}

function isNext(msg) {
  const m = normalize(msg);
  return m === "siguiente" || m.includes("siguiente") || m.includes("continuar") || m.includes("proxima") || m.includes("próxima");
}

function isStartTour(msg) {
  const m = normalize(msg);
  return m.includes("modo recorrido") || m.includes("recorrido") || m.includes("ir seccion por seccion") || m.includes("ir sección por sección");
}

function formatSection(section, total) {
  const header = `Sección ${section.number}/${total}: ${section.title}`;
  const body = section.content || "(Sin contenido)";
  return `${header}\n\n${body}`.trim();
}

// ===============
// State (simple, per visitor name) - in-memory
// Nota: en serverless no es 100% persistente, pero sirve para demo.
// ===============
const tourState = new Map(); // key: visitorName -> currentSectionNumber

// ===============
// Handler
// ===============
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }

  try {
    const body = req.body || {};
    const message = String(body.message || "").trim();
    const name = String(body.name || "Visitante").trim() || "Visitante";

    if (!message) {
      return res.status(400).json({ error: "Mensaje requerido." });
    }

    const planText = loadPlanText();
    const sections = parseSections(planText);
    const totalSections = sections.filter(s => s.number > 0).length;

    // 1) Si piden plan completo → damos índice + opciones
    if (isAskFullPlan(message)) {
      const index = buildIndex(sections);
      return res.status(200).json({
        reply:
          `Claro, ${name}. El plan es largo, así que te lo muestro de forma navegable.\n\n` +
          `📌 Índice:\n${index}\n\n` +
          `Podés responder:\n` +
          `• "Sección 3" (para ver una sección específica)\n` +
          `• "Modo recorrido" (para avanzar de a una con "siguiente")\n` +
          `• "Índice" (para volver a ver el menú)\n`
      });
    }

    // 2) Índice directo
    if (isAskIndex(message)) {
      const index = buildIndex(sections);
      return res.status(200).json({
        reply:
          `📌 Índice del plan:\n${index}\n\n` +
          `Decime "Sección X" para abrirla, o "Modo recorrido" para ir de a una.`
      });
    }

    // 3) Arrancar modo recorrido
    if (isStartTour(message)) {
      // empezamos en 1
      tourState.set(name, 1);
      const first = getSectionByNumber(sections, 1);
      if (!first) {
        return res.status(200).json({ reply: "No encontré la Sección 1 en el plan. Revisá el formato de títulos (1. ...)." });
      }
      return res.status(200).json({
        reply:
          `Perfecto, ${name}. Arrancamos el recorrido.\n\n` +
          `${formatSection(first, totalSections)}\n\n` +
          `Cuando quieras, decime "siguiente".`
      });
    }

    // 4) “Siguiente” en modo recorrido
    if (isNext(message)) {
      const current = tourState.get(name) || 0;
      const nextN = current + 1;

      const nextSection = getSectionByNumber(sections, nextN);
      if (!nextSection) {
        tourState.delete(name);
        return res.status(200).json({
          reply:
            `Listo, ${name}. Llegamos al final del plan.\n\n` +
            `Si querés volver a navegar: decime "Índice" o pedime una "Sección X".`
        });
      }

      tourState.set(name, nextN);
      return res.status(200).json({
        reply:
          `${formatSection(nextSection, totalSections)}\n\n` +
          `Decime "siguiente" para continuar o "Índice" para elegir otra.`
      });
    }

    // 5) Si piden una sección puntual
    const wanted = extractSectionNumber(message);
    if (wanted) {
      const sec = getSectionByNumber(sections, wanted);
      if (!sec) {
        return res.status(200).json({
          reply:
            `No encontré la Sección ${wanted}. Decime "Índice" para ver los números disponibles.`
        });
      }
      // si el usuario salta a una sección, actualizamos estado para seguir desde ahí
      tourState.set(name, wanted);
      return res.status(200).json({
        reply:
          `${formatSection(sec, totalSections)}\n\n` +
          `Si querés seguir desde acá, decime "siguiente".`
      });
    }

    // 6) Preguntas normales → OpenAI, pero restringido a tu plan
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        reply:
          `Falta configurar OPENAI_API_KEY.\n\n` +
          `Mientras tanto, podés pedirme "Índice", "Plan completo" o "Sección X".`
      });
    }

    const openai = new OpenAI({ apiKey });

    const system = `
Sos el Asistente Estratégico Ejecutivo del plan de Martín Xavier Urtasun Rubio para el rol de Product Owner en la célula BIT (CoE IA).
Objetivo: explicar y defender la propuesta ante líderes de negocio y tecnología.
Tono: profesional, ejecutivo, claro, resolutivo, con entusiasmo técnico.
Reglas:
- Respondé SOLO con información del plan provisto. No inventes.
- Si algo no está en el plan, decí "Eso no está explicitado en el documento" y sugerí cómo lo encararía.
- Si preguntan "plan completo", sugerí usar el índice/secciones (no pegues todo).
Plan:
${planText}
`.trim();

    const user = `Visitante: ${name}\nPregunta: ${message}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 900
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "No pude generar respuesta.";

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("ERROR /api/chat:", error);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};
