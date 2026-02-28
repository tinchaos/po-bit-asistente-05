const planStore = require('../lib/plan-store');
const { buildSystemPrompt } = require('../lib/prompt');
const { addInteraction } = require('../lib/interactions-store');

function sendJson(res, status, data) {
  res.status(status).json(data);
}

function resolveGetPlan() {
  if (typeof planStore.getPlan === 'function') return planStore.getPlan;
  if (planStore.default && typeof planStore.default.getPlan === 'function') return planStore.default.getPlan;
  throw new Error('getPlan no disponible en plan-store');
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const allowedRoles = new Set(['user', 'assistant']);

  return history
    .filter((m) => m && allowedRoles.has(m.role) && typeof m.content === 'string' && m.content.trim())
    .slice(-14) // espejo del front
    .map((m) => ({ role: m.role, content: m.content.trim() }));
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Método no permitido.' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const message = req.body?.message;
    const userName = req.body?.userName;
    const history = sanitizeHistory(req.body?.history);

    if (typeof message !== 'string' || !message.trim()) {
      return sendJson(res, 400, { error: 'Mensaje inválido.' });
    }

    // logging no bloqueante
    try {
      await addInteraction({ userName, question: message.trim() });
    } catch (_error) {}

    if (!OPENAI_API_KEY) {
      return sendJson(res, 500, { error: 'Falta configurar OPENAI_API_KEY.' });
    }

    const getPlan = resolveGetPlan();
    const plan = await getPlan();
    const systemPrompt = buildSystemPrompt({ userName, plan });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message.trim() }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        messages
      })
    });

    if (!response.ok) {
      return sendJson(res, 500, { error: `Error de OpenAI: ${await response.text()}` });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';
    return sendJson(res, 200, { reply });
  } catch (error) {
    return sendJson(res, 500, { error: `Error interno: ${error.message}` });
  }
};
