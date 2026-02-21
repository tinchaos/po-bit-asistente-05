const fs = require('fs/promises');
const path = require('path');

const PLAN_PATH = path.join(process.cwd(), 'data', 'plan.txt');
const KV_KEY = process.env.PLAN_KV_KEY || 'bit_plan_text';

function hasVercelKV() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvGet(key) {
  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });

  if (!response.ok) {
    throw new Error(`KV GET error: ${response.status}`);
  }

  const data = await response.json();
  return data?.result || '';
}

async function kvSet(key, value) {
  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });

  if (!response.ok) {
    throw new Error(`KV SET error: ${response.status}`);
  }
}

async function readLocalPlan() {
  try {
    return await fs.readFile(PLAN_PATH, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return 'No hay plan cargado todavía.';
    throw error;
  }
}

async function writeLocalPlan(value) {
  await fs.writeFile(PLAN_PATH, value, 'utf8');
}

async function getPlan() {
  if (hasVercelKV()) {
    const value = await kvGet(KV_KEY);
    if (value) return value;
  }

  return readLocalPlan();
}

async function setPlan(value) {
  if (hasVercelKV()) {
    await kvSet(KV_KEY, value);
    return;
  }

  await writeLocalPlan(value);
}

module.exports = { getPlan, setPlan, hasVercelKV };
