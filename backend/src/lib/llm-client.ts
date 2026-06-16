interface LLMResponse {
  text: string;
}

async function callOpenAI(prompt: string): Promise<LLMResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ''}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return { text: data.choices[0]?.message?.content?.trim() || '' };
}

async function callAnthropic(prompt: string): Promise<LLMResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ text: string }>;
  };

  return { text: data.content[0]?.text?.trim() || '' };
}

export async function callLLM(prompt: string): Promise<string> {
  const provider = process.env.LLM_PROVIDER || 'openai';

  try {
    if (provider === 'openai') {
      const result = await callOpenAI(prompt);
      return result.text;
    }

    if (provider === 'anthropic') {
      const result = await callAnthropic(prompt);
      return result.text;
    }

    throw new Error(`Unknown LLM provider: ${provider}`);
  } catch (err) {
    console.error(`[LLMClient] callLLM failed (provider: ${provider}):`, err);
    throw err;
  }
}

// --- Multimodal / Vision support (gpt-4o-mini only) ---

export interface LLMImageInput {
  prompt: string;
  imageUrls: string[];
}

async function callOpenAIWithImages(input: LLMImageInput): Promise<LLMResponse> {
  const imageContent = input.imageUrls.map(url => ({
    type: 'image_url' as const,
    image_url: { url, detail: 'low' as const },
  }));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ''}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: input.prompt },
            ...imageContent,
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI Vision API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return { text: data.choices[0]?.message?.content?.trim() || '' };
}

export async function callLLMWithImages(input: LLMImageInput): Promise<string> {
  try {
    const result = await callOpenAIWithImages(input);
    return result.text;
  } catch (err) {
    console.error('[LLMClient] callLLMWithImages failed:', err);
    throw err;
  }
}

export async function compareAddresses(addressA: string, addressB: string): Promise<boolean> {
  const prompt = `Sos un validador de direcciones en Argentina.

Dirección A: "${addressA}"
Dirección B: "${addressB}"

¿Ambas direcciones corresponden al mismo domicilio (mismo lugar físico), considerando que pueden estar escritas con distinto formato, abreviaciones, mayúsculas, o con/sin referencias adicionales?

Responde SOLO con una palabra: SI o NO`;

  try {
    const response = await callLLM(prompt);
    return response.trim().toUpperCase().startsWith('SI');
  } catch {
    return false;
  }
}

export interface ExtractedServiceZone {
  serviceName: string | null;
  zoneName: string | null;
}

export async function extractServiceAndZone(message: string): Promise<ExtractedServiceZone> {
  const prompt = `Analizá el siguiente mensaje de un usuario que está buscando un servicio del hogar en Mendoza, Argentina.

Mensaje: "${message}"

Extraé:
1. El tipo de servicio que menciona (plomero, electricista, gasista, pintor, albañil, cerrajero, técnico de aire acondicionado, etc.). Si no menciona ninguno, devolvé null.
2. El departamento o zona de Mendoza que menciona (Godoy Cruz, Las Heras, Maipú, Guaymallén, Capital, Luján de Cuyo, etc.). Si no menciona ninguno, devolvé null.

Respondé SOLO con un JSON válido, sin texto adicional, sin backticks:
{"serviceName": "plomero", "zoneName": "Godoy Cruz"}`;

  try {
    const response = await callLLM(prompt);
    const clean = response.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean) as ExtractedServiceZone;
    return {
      serviceName: parsed.serviceName || null,
      zoneName: parsed.zoneName || null,
    };
  } catch {
    return { serviceName: null, zoneName: null };
  }
}

export async function extractName(text: string): Promise<string | null> {
  const prompt = `Del siguiente mensaje, extraé SOLO el nombre propio de una persona si está presente.
Si no hay ningún nombre propio, respondé exactamente: null
Si hay un nombre, respondé SOLO el nombre, sin puntos ni explicaciones.

Mensaje: "${text}"`;

  try {
    const response = await callLLM(prompt);
    const clean = response.trim();
    if (clean === 'null' || clean.length > 40 || clean.includes('.')) return null;
    return clean;
  } catch {
    return null;
  }
}

export async function transcribeAudio(audioUrl: string): Promise<string> {
  const model = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';

  const response = await fetch(audioUrl);
  if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());

  const ext = audioUrl.split('.').pop()?.split('?')[0] || 'ogg';
  const mimeType = ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`;

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', model);
  formData.append('language', 'es');

  const transcribeRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ''}`,
    },
    body: formData,
  });

  if (!transcribeRes.ok) {
    throw new Error(`OpenAI transcription failed: ${transcribeRes.status}`);
  }

  const data = (await transcribeRes.json()) as { text: string };
  return data.text?.trim() || '';
}
