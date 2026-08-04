import prisma from '../../lib/prisma';
import { LLMUsageData } from '../../lib/llm-client';

interface AggregatedLLMUsage {
  key: string;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgDurationMs: number | null;
}

interface DailyLLMCost {
  date: string;
  totalCalls: number;
  totalCostUsd: number;
}

interface AssociationBreakdown {
  associated: { totalCalls: number; totalCostUsd: number };
  general: { totalCalls: number; totalCostUsd: number };
}

export class LLMRepository {
  async create(data: LLMUsageData): Promise<void> {
    await prisma.lLMUsage.create({
      data: {
        requestId: data.requestId,
        userId: data.userId,
        promptKey: data.promptKey,
        provider: data.provider,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        costUsd: data.costUsd,
        durationMs: data.durationMs,
      },
    });
  }

  async getAggregatedByModel(from?: Date, to?: Date): Promise<AggregatedLLMUsage[]> {
    const result = await prisma.lLMUsage.groupBy({
      by: ['model'],
      where: { createdAt: { gte: from, lte: to } },
      _count: { id: true },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      _avg: { durationMs: true },
    });
    return result.map(r => ({
      key: r.model,
      totalCalls: r._count.id,
      totalInputTokens: r._sum.inputTokens ?? 0,
      totalOutputTokens: r._sum.outputTokens ?? 0,
      totalCostUsd: r._sum.costUsd ?? 0,
      avgDurationMs: r._avg.durationMs ?? null,
    }));
  }

  async getAggregatedByPromptKey(from?: Date, to?: Date): Promise<AggregatedLLMUsage[]> {
    const result = await prisma.lLMUsage.groupBy({
      by: ['promptKey'],
      where: { createdAt: { gte: from, lte: to } },
      _count: { id: true },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      _avg: { durationMs: true },
    });
    return result.map(r => ({
      key: r.promptKey ?? 'general',
      totalCalls: r._count.id,
      totalInputTokens: r._sum.inputTokens ?? 0,
      totalOutputTokens: r._sum.outputTokens ?? 0,
      totalCostUsd: r._sum.costUsd ?? 0,
      avgDurationMs: r._avg.durationMs ?? null,
    }));
  }

  async getAggregatedByProvider(from?: Date, to?: Date): Promise<AggregatedLLMUsage[]> {
    const result = await prisma.lLMUsage.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: from, lte: to } },
      _count: { id: true },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      _avg: { durationMs: true },
    });
    return result.map(r => ({
      key: r.provider,
      totalCalls: r._count.id,
      totalInputTokens: r._sum.inputTokens ?? 0,
      totalOutputTokens: r._sum.outputTokens ?? 0,
      totalCostUsd: r._sum.costUsd ?? 0,
      avgDurationMs: r._avg.durationMs ?? null,
    }));
  }

  async getTotalCost(from?: Date, to?: Date): Promise<number> {
    const result = await prisma.lLMUsage.aggregate({
      where: { createdAt: { gte: from, lte: to } },
      _sum: { costUsd: true },
    });
    return result._sum.costUsd ?? 0;
  }

  async getAvgCostPerRequest(from?: Date, to?: Date): Promise<number> {
    const result = await prisma.lLMUsage.groupBy({
      by: ['requestId'],
      where: { createdAt: { gte: from, lte: to }, requestId: { not: null } },
      _sum: { costUsd: true },
    });
    if (result.length === 0) return 0;
    const total = result.reduce((sum, r) => sum + (r._sum.costUsd ?? 0), 0);
    return total / result.length;
  }

  async getCostsByDay(from?: Date, to?: Date): Promise<DailyLLMCost[]> {
    const result = await prisma.$queryRaw<{ date: Date; totalCalls: bigint; totalCostUsd: number }[]>`
      SELECT
        DATE_TRUNC('day', "createdAt") as date,
        COUNT(*)::bigint as "totalCalls",
        SUM("costUsd") as "totalCostUsd"
      FROM "LLMUsage"
      WHERE "createdAt" >= ${from ?? new Date(0)}
        AND "createdAt" <= ${to ?? new Date()}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;
    return result.map(r => ({
      date: r.date.toISOString().split('T')[0],
      totalCalls: Number(r.totalCalls),
      totalCostUsd: r.totalCostUsd,
    }));
  }

  async getAssociationBreakdown(from?: Date, to?: Date): Promise<AssociationBreakdown> {
    const result = await prisma.$queryRaw<{ associated: boolean; totalCalls: bigint; totalCostUsd: number }[]>`
      SELECT
        ("requestId" IS NOT NULL) as associated,
        COUNT(*)::bigint as "totalCalls",
        SUM("costUsd") as "totalCostUsd"
      FROM "LLMUsage"
      WHERE "createdAt" >= ${from ?? new Date(0)}
        AND "createdAt" <= ${to ?? new Date()}
      GROUP BY ("requestId" IS NOT NULL)
    `;
    const assoc = result.find(r => r.associated) ?? { totalCalls: BigInt(0), totalCostUsd: 0 };
    const general = result.find(r => !r.associated) ?? { totalCalls: BigInt(0), totalCostUsd: 0 };
    return {
      associated: { totalCalls: Number(assoc.totalCalls), totalCostUsd: assoc.totalCostUsd },
      general: { totalCalls: Number(general.totalCalls), totalCostUsd: general.totalCostUsd },
    };
  }
}
