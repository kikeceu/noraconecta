const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

export async function parseScheduledAt(
  availabilityText: string,
  referenceDate: Date,
): Promise<Date | null> {
  if (!OPENAI_API_KEY) {
    console.warn('[llm] OPENAI_API_KEY not configured, skipping LLM date parsing');
    return null;
  }

  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const refStr = referenceDate.toISOString().slice(0, 10);
  const refDayName = dayNames[referenceDate.getDay()];

  const prompt =
    `Extraé la fecha y hora del siguiente texto y devolvé SOLO un objeto JSON con este formato exacto:
{ "date": "YYYY-MM-DD", "time": "HH:MM" }

Reglas:
- HOY es ${refStr} (${refDayName}). Usá esta fecha como referencia.
- "viernes", "sábado", etc. → el próximo día de semana DESPUÉS de hoy. Si el día coincide con hoy, usá hoy.
- "mañana" → el día siguiente a hoy.
- "hoy" → ${refStr}.
- Si no se menciona día de semana ni fecha explícita → date: null.
- Si no se menciona hora → time: null.
- Si no podés determinar con certeza → date: null, time: null.

No incluyas explicaciones ni texto adicional. Solo el JSON.

Texto: "${availabilityText}"`;

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
