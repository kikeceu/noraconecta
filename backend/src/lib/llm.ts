const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

export async function parseScheduledAt(
  availabilityText: string,
  referenceDate: Date,
  clientAvailability?: string,
): Promise<Date | null> {
  if (!OPENAI_API_KEY) {
    console.warn('[llm] OPENAI_API_KEY not configured, skipping LLM date parsing');
    return null;
  }

  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const refStr = referenceDate.toISOString().slice(0, 10);
  const refDayName = dayNames[referenceDate.getDay()];

  const contextLines = [
    `Fecha de referencia (hoy): ${refStr} (${refDayName})`,
  ];

  if (clientAvailability) {
    contextLines.push(`Disponibilidad propuesta por el usuario: "${clientAvailability}"`);
  }

  contextLines.push(`Texto a analizar: "${availabilityText}"`);

  const prompt =
    `Extraé la fecha y hora del texto a analizar y devolvé SOLO un objeto JSON con este formato exacto:
{ "date": "YYYY-MM-DD", "time": "HH:MM" }

Contexto:
${contextLines.join('\n')}

Reglas:
- Usá la fecha de referencia como HOY.
- "viernes", "sábado", etc. → el próximo día de semana DESPUÉS de hoy. Si el día coincide con hoy, usá hoy.
- "mañana" → el día siguiente a hoy.
- "hoy" → ${refStr}.
- Si el texto a analizar es una confirmación o aceptación sin fecha explícita (ej: "confirmo", "dale", "ok") → date: null, time: null.
- Si el texto a analizar propone un cambio parcial (ej: "mejor a las 16", "que tal a las 10"), usá la disponibilidad del usuario para inferir el día que falta y completar la fecha.
- Si el texto a analizar no menciona día de semana ni fecha explícita, y no se puede inferir de la disponibilidad del usuario → date: null.
- Si no se menciona hora → time: null.
- Si no podés determinar con certeza → date: null, time: null.

No incluyas explicaciones ni texto adicional. Solo el JSON.`;

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error('[llm] OpenAI API error:', response.status);
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.warn('[llm] Empty response from LLM');
      return null;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[llm] No JSON found in LLM response:', content);
      return null;
    }

    const parsed: { date: string | null; time: string | null } = JSON.parse(jsonMatch[0]);

    if (!parsed.date || !parsed.time) {
      return null;
    }

    const dateTime = new Date(`${parsed.date}T${parsed.time}:00`);
    if (isNaN(dateTime.getTime())) {
      console.warn('[llm] Invalid date parsed:', parsed);
      return null;
    }

    return dateTime;
  } catch (err) {
    console.error('[llm] parseScheduledAt error:', err);
    return null;
  }
}
