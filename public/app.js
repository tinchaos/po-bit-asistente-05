const chatEl = document.getElementById('chat');
const formEl = document.getElementById('form');
const inputEl = document.getElementById('message');

let userName = '';
let choosingInitialMenu = false;

// Historial estructurado para el “plus”
const conversationHistory = []; // { role: 'user'|'assistant', content: string }

// Esto lo mantenías para tu resumen / tracking
const questionsAsked = [];
let summarySent = false;

function pushHistory(role, content) {
  if (!content || typeof content !== 'string') return;
  conversationHistory.push({ role, content });

  // evitamos que crezca infinito
  if (conversationHistory.length > 40) {
    conversationHistory.splice(0, conversationHistory.length - 40);
  }
}

function normalizeUserMessage(text) {
  const normalized = text.trim().toLowerCase();

  // ✅ Solo mapear 1/2/3 cuando estamos eligiendo el menú inicial
  if (choosingInitialMenu) {
    if (normalized === '1') return 'Quiero ver el plan completo.';
    if (normalized === '2') return 'Sugerime opciones concretas.';
    if (normalized === '3') return 'Tengo una duda puntual y quiero verla con vos.';
  }

  return text;
}

function isFinishIntent(text) {
  const normalized = text.trim().toLowerCase();
  return ['no', 'nada más', 'nada mas', 'terminar', 'finalizar', 'eso es todo', 'listo, gracias'].includes(normalized);
}

async function sendConversationSummary(reason) {
  if (summarySent || !questionsAsked.length) return;

  summarySent = true;

  try {
    await fetch('/api/conversation-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName,
        reason,
        questions: questionsAsked
      }),
      keepalive: true
    });
  } catch (_error) {
    // no-op
  }
}

function addMessage(text, sender = 'bot') {
  const div = document.createElement('div');
  div.className = `msg ${sender}`;
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;

  // ✅ Guardamos historial SOLO de mensajes reales (no “escribiendo...”)
  if (sender === 'user') pushHistory('user', text);
  if (sender === 'bot') pushHistory('assistant', text);
}

async function sendToBot(message) {
  addMessage(message, 'user');

  const loading = document.createElement('div');
  loading.className = 'msg bot';
  loading.textContent = 'Escribiendo...';
  chatEl.appendChild(loading);
  chatEl.scrollTop = chatEl.scrollHeight;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        userName,
        // 🔥 PLUS: mandamos historial reciente (sin system prompt)
        history: conversationHistory.slice(-14)
      })
    });

    const data = await response.json();
    loading.remove();

    const reply = data.reply || data.error || 'No pude responder en este momento.';
    addMessage(reply, 'bot');
  } catch (_error) {
    loading.remove();
    addMessage('Hubo un problema de conexión con el asistente.', 'bot');
  }
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';

  // Primer mensaje = nombre
  if (!userName) {
    userName = text;
    addMessage(text, 'user');

    const menu =
      `¡Mucho gusto, ${userName}! 👋\n` +
      '¿Cómo preferís avanzar?\n' +
      '1) Ver el plan completo (te muestro el índice y elegís qué sección ver).\n' +
      '2) Que te sugiera opciones concretas.\n' +
      '3) Contarme una duda puntual y lo vemos juntos.';

    addMessage(menu, 'bot');

    // ✅ a partir de acá, 1/2/3 se interpretan como menú inicial
    choosingInitialMenu = true;
    return;
  }

  const mappedText = normalizeUserMessage(text);

  // ✅ al primer input post-menú inicial, dejamos de mapear 1/2/3
  if (choosingInitialMenu) choosingInitialMenu = false;

  questionsAsked.push(mappedText);

  await sendToBot(mappedText);

  if (isFinishIntent(text) || isFinishIntent(mappedText)) {
    await sendConversationSummary('finished');
  }
});

window.addEventListener('pagehide', () => {
  void sendConversationSummary('abandoned');
});

// Mensajes iniciales
addMessage('¡Hola! Soy el asistente del plan de trabajo de Martín para Product Owner de BIT. 👋', 'bot');
addMessage('Primero, ¿cómo te llamás?', 'bot');
