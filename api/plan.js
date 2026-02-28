const planStore = require('../lib/plan-store');

function sendJson(res, status, data) {
  res.status(status).json(data);
}

function resolvePlanStore() {
  const getPlan = typeof planStore.getPlan === 'function'
    ? planStore.getPlan
    : planStore.default && typeof planStore.default.getPlan === 'function'
      ? planStore.default.getPlan
      : null;

  const setPlan = typeof planStore.setPlan === 'function'
    ? planStore.setPlan
    : planStore.default && typeof planStore.default.setPlan === 'function'
      ? planStore.default.setPlan
      : null;

  if (!getPlan || !setPlan) throw new Error('plan-store inválido');
  return { getPlan, setPlan };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { getPlan } = resolvePlanStore();
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

      const { setPlan } = resolvePlanStore();
      await setPlan(plan.trim());
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { error: 'Método no permitido.' });
  } catch (error) {
    return sendJson(res, 500, { error: `Error interno: ${error.message}` });
  }
};

