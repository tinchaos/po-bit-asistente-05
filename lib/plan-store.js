const fs = require('fs/promises');
const path = require('path');

// Robustez: no depender de process.cwd()
const PLAN_PATH = path.join(__dirname, '..', 'data', 'plan.txt');

let cachedPlan = null;
let cachedMtimeMs = null;

async function getPlan() {
  const stat = await fs.stat(PLAN_PATH);
  if (cachedPlan && cachedMtimeMs === stat.mtimeMs) return cachedPlan;

  const plan = await fs.readFile(PLAN_PATH, 'utf8');
  cachedPlan = plan;
  cachedMtimeMs = stat.mtimeMs;
  return plan;
}

async function setPlan(planText) {
  if (typeof planText !== 'string' || !planText.trim()) {
    throw new Error('El texto del plan es obligatorio.');
  }

  await fs.writeFile(PLAN_PATH, planText.trim(), 'utf8');
  const stat = await fs.stat(PLAN_PATH);
  cachedPlan = planText.trim();
  cachedMtimeMs = stat.mtimeMs;
}

module.exports = { getPlan, setPlan };
