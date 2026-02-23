const fs = require('fs/promises');
const path = require('path');

const INTERACTIONS_PATH = path.join(process.cwd(), 'data', 'interactions.json');
const MAX_ITEMS = 1000;

async function readInteractions() {
  try {
    const raw = await fs.readFile(INTERACTIONS_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeInteractions(items) {
  await fs.writeFile(INTERACTIONS_PATH, JSON.stringify(items, null, 2), 'utf8');
}

async function addInteraction({ userName, question }) {
  const items = await readInteractions();
  items.push({
    userName: userName || 'visitante',
    question,
    createdAt: new Date().toISOString()
  });

  const trimmed = items.slice(-MAX_ITEMS);
  await writeInteractions(trimmed);
}

module.exports = { readInteractions, addInteraction };
