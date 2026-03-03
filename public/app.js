const chatEl = document.getElementById('chat');
const formEl = document.getElementById('form');
const inputEl = document.getElementById('message');

let userName = '';
let choosingInitialMenu = false;

const conversationHistory = [];
const questionsAsked = [];

let summarySent = false;

// ⭐ Puntaje
let awaitingScore = false;
let sessionScore = null;

// ⏱ Inactividad (5 minutos)
const INACTIVITY_MS = 5 * 60 * 1000;
let inactivityTimer = null;

const FINAL_MESSAGE =
  'Espero que te haya sido útil la herramienta, y que consideres a Martín como el principal candidato. ¡Que tengas un excelente día!';

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(async () => {
    if (!summarySent) {
      await sendConversationSummary('abandoned');
      addMessage('La sesión se cerró automáticamente por inactividad.', 'bot');
    }
  }, INACTIVITY_MS);
}

function pushHistory(role, content) {
  if (!content || typeof content !== 'string') return;
  conversationHistory.push({ role, content });

  if (conversationHistory.length > 40) {
    conversationHistory.splice(0, conversationHistory.length - 40);
  }
}

function normalizeUserMessage(text) {
  const normalized = text.trim().toLowerCase();

  if (choosingInitialMenu) {
    if (normalized === '1') return 'Quiero ver el plan completo.';
    if (normalized === '2') return 'Sugerime opciones concretas.';
    if (normalized === '3') return 'Tengo una duda puntual y quiero verla con vos.';
  }

  return text;
}

function isFinishIntent(text) {
  const normalized = text.trim().toLowerCase();
  return ['finalizar', 'fin', 'salir', 'cerrar', 'terminar'].includes(normalized);
}

function parseScore(text) {
  const raw = String(text || '').trim().toLowerCase();
  if (!raw) return null;

  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return n;

  const frac = raw.match(/^(\d)\s*\/\s*5$/);
  if (frac) {
    const k = Number(frac[1]);
    if (k >= 1 && k <= 5) return k;
  }

  const words = { uno:1, dos:2, tres:3, cuatro:4, cinco:5 };
  if (words[raw] != null) return words[raw];

  return null;
}

async function sendConversationSummary(reason) {
  if (summarySent) return;
  summarySent = true;

  try {
    await fetch('/api/conversation-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName,
        reason,
        score: sessionScore,
        questions: questionsAsked
      }),
      keepalive: true
    });
  } catch (_) {}
}

function addMessage(text, sender = 'bot') {
  const div = document.createElement('div');
  div.className = `msg ${sender}`;
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;

  if (sender === 'user') pushHistory('user', text);
  if (sender === 'bot') pushHistory('assistant', text);
}

async function sendToBot(message) {
  addMessage(message, 'user');
  resetInactivityTimer();

  const loading = document.createElement('div');
  loading.className = 'msg bot';
  loading.textContent = 'Escribiendo...';
  chatEl.appendChild(loading);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        userName,
        history: conversationHistory.slice(-14)
      })
    });

    const data = await response.json();
    loading.remove();

    const reply = data.reply || data.error || 'No pude responder.';
    addMessage(reply, 'bot');
  } catch (_) {
    loading.remove();
    addMessage('Hubo un problema de conexión.', 'bot');
  }
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';

  resetInactivityTimer();

  // ⭐ Puntaje
  if (awaitingScore) {
    addMessage(text, 'user');

    const score = parseScore(text);
    if (!score) {
      addMessage('Por favor indicame un puntaje del 1 al 5.', 'bot');
      return;
    }

    sessionScore = score;
    awaitingScore = false;

    await sendConversationSummary('finished');
    addMessage(FINAL_MESSAGE, 'bot');
    return;
  }

  if (!userName) {
    userName = text;
    addMessage(text, 'user');

    addMessage(
      `¡Mucho gusto, ${userName}! 👋\n¿Querés ver el plan completo o hacer una consulta puntual?`,
      'bot'
    );

    choosingInitialMenu = true;
    return;
  }

  if (isFinishIntent(text)) {
    addMessage(text, 'user');
    awaitingScore = true;
    addMessage('Antes de cerrar, ¿qué puntaje del 1 al 5 le das al asistente?', 'bot');
    return;
  }

  const mappedText = normalizeUserMessage(text);
  if (choosingInitialMenu) choosingInitialMenu = false;

  questionsAsked.push(mappedText);
  await sendToBot(mappedText);
});

// Cierre por cambio de pestaña o navegación
window.addEventListener('pagehide', () => {
  void sendConversationSummary('abandoned');
});

// Inicio
addMessage('¡Hola! Soy el asistente del plan de trabajo de Martín para Product Owner de BIT. 👋', 'bot');
addMessage('Primero, ¿cómo te llamás?', 'bot');

resetInactivityTimer();
