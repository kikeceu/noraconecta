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
