const { sendConversationSummaryEmail } = require('../lib/mailer');

function sendJson(res, status, data) {
  res.status(status).json(data);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Método no permitido.' });
    }

    const { userName, reason, questions } = req.body || {};
    const cleanQuestions = Array.isArray(questions) ? questions.slice(0, 30) : [];

    const result = await sendConversationSummaryEmail({
      userName,
      reason: reason === 'finished' ? 'finished' : 'abandoned',
      questions: cleanQuestions
    });

    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    console.error('conversation-end error:', error);
    return sendJson(res, 500, { ok: false, error: `Error interno: ${error.message}` });
  }
};
