const DEFAULT_TO = 'tinchourtasun@icloud.com';

function buildHtml({ userName, reason, questions }) {
  const list = (questions || [])
    .filter(Boolean)
    .map((q) => `<li>${String(q).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`)
    .join('');

  return `
    <h2>Resumen de interacción con IA - BIT</h2>
    <p><strong>Usuario:</strong> ${userName || 'visitante'}</p>
    <p><strong>Motivo de cierre:</strong> ${reason === 'finished' ? 'Finalización explícita' : 'Abandono/cierre'}</p>
    <p><strong>Preguntas realizadas:</strong></p>
    <ul>${list || '<li>Sin preguntas registradas.</li>'}</ul>
  `;
}

async function sendConversationSummaryEmail({ userName, reason, questions }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL_TO || DEFAULT_TO;
  const from = process.env.NOTIFY_EMAIL_FROM || 'BIT Chat <onboarding@resend.dev>';

  if (!apiKey) {
    return { sent: false, reason: 'RESEND_API_KEY no configurada' };
  }

  const subject = `BIT IA | Resumen de conversación (${reason === 'finished' ? 'finalizada' : 'abandonada'})`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: buildHtml({ userName, reason, questions })
    })
  });

  if (!response.ok) {
    throw new Error(`Resend error: ${response.status} ${await response.text()}`);
  }

  return { sent: true };
}

module.exports = { sendConversationSummaryEmail };
