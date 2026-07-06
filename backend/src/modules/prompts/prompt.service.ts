import { promptRepository } from './prompt.repository';

const promptCache = new Map<string, string>();

export class PromptService {
  async getPrompt(key: string, vars: Record<string, string> = {}): Promise<string> {
    if (!promptCache.has(key)) {
      const record = await promptRepository.findByKey(key);
      if (record) {
        promptCache.set(key, record.content);
      } else {
        throw new Error(`Prompt not found: ${key}`);
      }
    }

    let prompt = promptCache.get(key)!;
    for (const [k, v] of Object.entries(vars)) {
      prompt = prompt.replaceAll(`{{${k}}}`, v ?? '');
    }
    return prompt;
  }

  invalidate(key: string): void {
    promptCache.delete(key);
  }

  invalidateAll(): void {
    promptCache.clear();
  }
}

export const promptService = new PromptService();
