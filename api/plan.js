const { getPlan, setPlan } = require('../lib/plan-store');

function sendJson(res, status, data) {
  res.status(status).json(data);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const plan = await getPlan();
      return sendJson(res, 200, { plan });
    }

    if (req.method === 'POST') {
      const adminToken = process.env.ADMIN_TOKEN;
      if (adminToken && req.headers['x-admin-token'] !== adminToken) {
        return sendJson(res, 401, { error: 'Token de administración inválido.' });
      }

      const plan = req.body?.plan;
      if (typeof plan !== 'string' || !plan.trim()) {
        return sendJson(res, 400, { error: 'El texto del plan es obligatorio.' });
      }

      await setPlan(plan.trim());
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { error: 'Método no permitido.' });
  } catch (error) {
    return sendJson(res, 500, { error: `Error interno: ${error.message}` });
  }
};
