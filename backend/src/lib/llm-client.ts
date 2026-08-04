export interface LLMUsageData {
  requestId?: string;
  userId?: string;
  promptKey?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs?: number;
}

type UsageHandler = (usage: LLMUsageData) => void;

let _usageHandler: UsageHandler | null = null;
const _modelPrices: Record<string, { input: number; output: number }> = {};

export function registerLLMUsageHandler(handler: UsageHandler): void {
  _usageHandler = handler;
}

export function registerModelPrices(prices: Record<string, { input: number; output: number }>): void {
  Object.assign(_modelPrices, prices);
}

function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const prices = _modelPrices[model] ?? _modelPrices['default'] ?? { input: 0.00015, output: 0.0006 };
  return (inputTokens / 1_000_000 * prices.input) + (outputTokens / 1_000_000 * prices.output);
}

export interface LLMCallContext {
  requestId?: string;
  userId?: string;
  promptKey?: string;
}

interface LLMResponse {
  text: string;
}

async function callOpenAI(prompt: string, context?: LLMCallContext): Promise<LLMResponse> {
  const start = Date.now();

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
    usage?: { prompt_tokens: number; completion_tokens: number };
    model?: string;
  };

  const durationMs = Date.now() - start;

  if (_usageHandler && data.usage) {
    const model = data.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    _usageHandler({
      ...context,
      provider: 'openai',
      model,
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
      costUsd: calculateCostUsd(model, data.usage.prompt_tokens, data.usage.completion_tokens),
      durationMs,
    });
  }

  return { text: data.choices[0]?.message?.content?.trim() || '' };
}

async function callAnthropic(prompt: string, context?: LLMCallContext): Promise<LLMResponse> {
  const start = Date.now();

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
    usage?: { input_tokens: number; output_tokens: number };
    model?: string;
  };

  const durationMs = Date.now() - start;

  if (_usageHandler && data.usage) {
    const model = data.model || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
    _usageHandler({
      ...context,
      provider: 'anthropic',
      model,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      costUsd: calculateCostUsd(model, data.usage.input_tokens, data.usage.output_tokens),
      durationMs,
    });
  }

  return { text: data.content[0]?.text?.trim() || '' };
}

export async function callLLM(prompt: string, context?: LLMCallContext): Promise<string> {
  const provider = process.env.LLM_PROVIDER || 'openai';

  try {
    if (provider === 'openai') {
      const result = await callOpenAI(prompt, context);
      return result.text;
    }

    if (provider === 'anthropic') {
      const result = await callAnthropic(prompt, context);
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

export async function compareAddresses(
  addressA: string,
  addressB: string,
  promptTemplate: string,
): Promise<boolean> {
  const prompt = promptTemplate
    .replaceAll('{{addressA}}', addressA)
    .replaceAll('{{addressB}}', addressB);

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

export async function extractServiceAndZone(
  message: string,
  promptTemplate: string,
): Promise<ExtractedServiceZone> {
  const prompt = promptTemplate.replaceAll('{{message}}', message);

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

export async function extractName(
  text: string,
  promptTemplate: string,
): Promise<string | null> {
  const prompt = promptTemplate.replaceAll('{{input}}', text);

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

export async function userRequestsLicenseByLLM(
  description: string,
  promptTemplate: string,
): Promise<boolean> {
  const prompt = promptTemplate.replaceAll('{{description}}', description);

  try {
    const response = await callLLM(prompt);
    return response.trim().toUpperCase() === 'SI';
  } catch {
    return false;
  }
}
