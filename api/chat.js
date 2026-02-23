const { getPlan } = require('../lib/plan-store');
const { buildSystemPrompt } = require('../lib/prompt');
const { addInteraction } = require('../lib/interactions-store');

function sendJson(res, status, data) {
  res.status(status).json(data);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Método no permitido.' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!OPENAI_API_KEY) {
      return sendJson(res, 500, { error: 'Falta configurar OPENAI_API_KEY.' });
    }

    const message = req.body?.message;
    const userName = req.body?.userName;

    if (typeof message !== 'string' || !message.trim()) {
      return sendJson(res, 400, { error: 'Mensaje inválido.' });
    }

    try {
      await addInteraction({ userName, question: message.trim() });
    } catch (_error) {
      // logging no bloqueante
    }

    const plan = await getPlan();
    const systemPrompt = buildSystemPrompt({ userName, plan });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
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
