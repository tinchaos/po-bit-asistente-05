const { readInteractions, addInteraction } = require('../lib/interactions-store');

function sendJson(res, status, data) {
  res.status(status).json(data);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const adminToken = process.env.ADMIN_TOKEN;
      if (adminToken && req.headers['x-admin-token'] !== adminToken) {
        return sendJson(res, 401, { error: 'Token de administración inválido.' });
      }

      const items = await readInteractions();
      return sendJson(res, 200, { items: items.reverse() });
    }

    if (req.method === 'POST') {
      const question = req.body?.question;
      if (typeof question !== 'string' || !question.trim()) {
        return sendJson(res, 400, { error: 'Pregunta inválida.' });
      }

      await addInteraction({ userName: req.body?.userName, question: question.trim() });
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { error: 'Método no permitido.' });
  } catch (error) {
    return sendJson(res, 500, { error: `Error interno: ${error.message}` });
  }
};
