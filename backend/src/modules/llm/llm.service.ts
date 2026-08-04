import { LLMRepository } from './llm.repository';
import { registerLLMUsageHandler, registerModelPrices } from '../../lib/llm-client';

export interface LLMCostsResponse {
  byModel: {
    key: string;
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
    avgDurationMs: number | null;
  }[];
  byPromptKey: {
    key: string;
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
    avgDurationMs: number | null;
  }[];
  byProvider: {
    key: string;
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
    avgDurationMs: number | null;
  }[];
  totalCost: number;
  avgCostPerRequest: number;
  costsByDay: { date: string; totalCalls: number; totalCostUsd: number }[];
  associationBreakdown: {
    associated: { totalCalls: number; totalCostUsd: number };
    general: { totalCalls: number; totalCostUsd: number };
  };
}

export class LLMService {
  constructor(private readonly llmRepository: LLMRepository) {}

  registerHandlers(modelPrices: Record<string, { input: number; output: number }>): void {
    registerModelPrices(modelPrices);
    registerLLMUsageHandler((usage) => {
      void this.llmRepository.create(usage).catch((err) => {
        console.error('[LLMService] Failed to log usage:', err);
      });
    });
  }

  async getCosts(from?: Date, to?: Date): Promise<LLMCostsResponse> {
    const [
      byModel,
      byPromptKey,
      byProvider,
      totalCost,
      avgCostPerRequest,
      costsByDay,
      associationBreakdown,
    ] = await Promise.all([
      this.llmRepository.getAggregatedByModel(from, to),
      this.llmRepository.getAggregatedByPromptKey(from, to),
      this.llmRepository.getAggregatedByProvider(from, to),
      this.llmRepository.getTotalCost(from, to),
      this.llmRepository.getAvgCostPerRequest(from, to),
      this.llmRepository.getCostsByDay(from, to),
      this.llmRepository.getAssociationBreakdown(from, to),
    ]);
    return {
      byModel,
      byPromptKey,
      byProvider,
      totalCost,
      avgCostPerRequest,
      costsByDay,
      associationBreakdown,
    };
  }
}
