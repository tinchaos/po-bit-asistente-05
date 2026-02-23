const chatEl = document.getElementById('chat');
const formEl = document.getElementById('form');
const inputEl = document.getElementById('message');

let userName = '';


function normalizeUserMessage(text) {
  const normalized = text.trim().toLowerCase();
  if (normalized === '1') return 'Quiero ver el plan completo.';
  if (normalized === '2') return 'Sugerime opciones concretas.';
  if (normalized === '3') return 'Tengo una duda puntual y quiero verla con vos.';
  return text;
}

function addMessage(text, sender = 'bot') {
  const div = document.createElement('div');
  div.className = `msg ${sender}`;
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function sendToBot(message) {
  addMessage(message, 'user');
  const loading = document.createElement('div');
  loading.className = 'msg bot';
  loading.textContent = 'Escribiendo...';
  chatEl.appendChild(loading);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, userName })
    });

    const data = await response.json();
    loading.remove();
    addMessage(data.reply || data.error || 'No pude responder en este momento.');
  } catch (_error) {
    loading.remove();
    addMessage('Hubo un problema de conexión con el asistente.');
  }
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';

  if (!userName) {
    userName = text;
    addMessage(text, 'user');
    addMessage(
      `¡Mucho gusto, ${userName}! 👋\n` +
      '¿Cómo preferís avanzar?\n' +
      '1) Ver el plan completo (te muestro el índice y elegís qué sección ver).\n' +
      '2) Que te sugiera opciones concretas.\n' +
      '3) Contarme una duda puntual y lo vemos juntos.'
    );
    return;
  }

  const mappedText = normalizeUserMessage(text);
  await sendToBot(mappedText);
});

addMessage('¡Hola! Soy el asistente del plan de trabajo de Martín para Product Owner de BIT. 👋');
addMessage('Primero, ¿cómo te llamás?');
