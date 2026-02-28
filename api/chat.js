const { getPlan } = require('../lib/plan-store');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

module.exports = async function handler(req, res) {
  try {
    const { message, history = [] } = req.body;

    const plan = await getPlan();

    const systemPrompt = `
Actúa como el asistente conversacional del plan de trabajo de Martín Urtasun para Product Owner de la Célula BIT.

Reglas:
- Si el usuario pide ver el plan completo, mostrale primero el índice numerado.
- Si el usuario responde con un número, interpretalo como la sección correspondiente del índice actual.
- No vuelvas automáticamente al menú inicial salvo que el usuario lo pida.
- Sé claro, profesional y conversacional.
- Usa el contenido del plan como fuente principal.

PLAN:
${plan}
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.4
    });

    const reply = completion.choices[0].message.content;

    res.status(200).json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: 'Error interno del servidor.' });
  }
};
