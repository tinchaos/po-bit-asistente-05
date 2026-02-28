const messagesContainer = document.getElementById('messages');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');

let userName = '';
let conversationHistory = [];
let choosingInitialMenu = false;

function addMessage(text, role) {
  const msg = document.createElement('div');
  msg.className = `message ${role}`;
  msg.innerText = text;
  messagesContainer.appendChild(msg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Guardamos historial estructurado
  conversationHistory.push({ role, content: text });
}

function normalizeUserMessage(text) {
  const normalized = text.trim().toLowerCase();

  // Solo mapear 1/2/3 cuando estamos en el menú inicial
  if (choosingInitialMenu) {
    if (normalized === '1') return 'Quiero ver el plan completo.';
    if (normalized === '2') return 'Sugerime opciones concretas.';
    if (normalized === '3') return 'Tengo una duda puntual y quiero verla con vos.';
  }

  return text;
}

async function sendToBot(message) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: conversationHistory.slice(-10) // 🔥 enviamos últimas 10 interacciones
      })
    });

    const data = await response.json();
    addMessage(data.reply, 'bot');
  } catch (err) {
    addMessage('Error al conectar con el asistente.', 'bot');
  }
}

async function handleSend() {
  const text = input.value.trim();
  if (!text) return;

  input.value = '';

  // Primer mensaje = nombre
  if (!userName) {
    userName = text;
    addMessage(text, 'user');

    const welcome =
`¡Mucho gusto, ${userName}! 👋
¿Cómo preferís avanzar?
1) Ver el plan completo (te muestro el índice y elegís qué sección ver).
2) Que te sugiera opciones concretas.
3) Contarme una duda puntual y lo vemos juntos.`;

    addMessage(welcome, 'bot');
    choosingInitialMenu = true;
    return;
  }

  addMessage(text, 'user');

  const mappedText = normalizeUserMessage(text);

  if (choosingInitialMenu) choosingInitialMenu = false;

  await sendToBot(mappedText);
}

sendBtn.addEventListener('click', handleSend);

input.addEventListener('keypress', function (e) {
  if (e.key === 'Enter') handleSend();
});
