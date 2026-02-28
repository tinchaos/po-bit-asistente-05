const DEFAULT_TO = 'murtasun@gmail.com'; // mail con el que creaste la cuenta de Resend
const DEFAULT_FROM = 'onboarding@resend.dev'; // obligatorio en modo sandbox

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtml({ userName, reason, questions }) {
  const list = (questions || [])
    .filter(Boolean)
    .map((q) => `<li>${escapeHtml(q)}</li>`)
    .join('');

  return `
    <h2>Resumen de interacción con IA - BIT</h2>
    <p><strong>Usuario:</strong> ${escapeHtml(userName || 'visitante')}</p>
    <p><strong>Motivo de cierre:</strong> ${
      reason === 'finished'
        ? 'Finalización explícita'
        : 'Abandono/cierre'
    }</p>
    <p><strong>Preguntas realizadas:</strong></p>
    <ul>${list || '<li>Sin preguntas registradas.</li>'}</ul>
  `;
}

async function sendConversationSummaryEmail({ userName, reason, questions }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY no configurada');
  }

  const subject = `BIT IA | Resumen de conversación (${
    reason === 'finished' ? 'finalizada' : 'abandonada'
  })`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: DEFAULT_FROM,
      to: [DEFAULT_TO],
      subject,
      html: buildHtml({ userName, reason, questions })
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend error: ${response.status} ${errorText}`);
  }

  return { sent: true };
}

module.exports = { sendConversationSummaryEmail };

