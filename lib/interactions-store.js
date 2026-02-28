const fs = require('fs/promises');
const path = require('path');

const INTERACTIONS_PATH = path.join(process.cwd(), 'data', 'interactions.json');
const MAX_ITEMS = 1000;
const KV_KEY = process.env.INTERACTIONS_KV_KEY || 'bit_interactions_log';

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
  return data?.result || '[]';
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

function normalizeItems(data) {
  return Array.isArray(data) ? data : [];
}

async function readLocalInteractions() {
  try {
    const raw = await fs.readFile(INTERACTIONS_PATH, 'utf8');
    return normalizeItems(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLocalInteractions(items) {
  await fs.writeFile(INTERACTIONS_PATH, JSON.stringify(items, null, 2), 'utf8');
}

async function readInteractions() {
  if (hasVercelKV()) {
    const raw = await kvGet(KV_KEY);
    return normalizeItems(JSON.parse(raw));
  }

  return readLocalInteractions();
}

async function writeInteractions(items) {
  if (hasVercelKV()) {
    await kvSet(KV_KEY, JSON.stringify(items));
    return;
  }

  await writeLocalInteractions(items);
}

async function addInteraction({ userName, question }) {
  try {
    const items = await readInteractions();
    items.push({
      userName: userName || 'visitante',
      question,
      createdAt: new Date().toISOString()
    });

    const trimmed = items.slice(-MAX_ITEMS);
    await writeInteractions(trimmed);
  } catch (error) {
    // En entornos serverless sin KV, el filesystem puede ser read-only (EROFS).
    // No rompemos el chat por un fallo de logging.
    if (error.code === 'EROFS') return;
    throw error;
  }
}

module.exports = { readInteractions, addInteraction };

