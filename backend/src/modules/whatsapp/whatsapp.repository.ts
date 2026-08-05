import prisma from '../../lib/prisma';
import { WhatsAppTemplateUsageData, WhatsAppServiceConversationData } from '../../lib/whatsapp-adapter';
import { WhatsAppTemplate } from '@prisma/client';

interface AggregatedTemplateUsage {
  templateName: string;
  category: string;
  totalSent: number;
  totalCostUsd: number;
}

export class WhatsAppRepository {
  async createTemplateUsage(data: WhatsAppTemplateUsageData): Promise<void> {
    await prisma.whatsAppTemplateUsage.create({ data });
  }

  async createServiceConversation(data: WhatsAppServiceConversationData): Promise<void> {
    await prisma.whatsAppServiceConversation.create({ data });
  }

  async findTemplateCatalog(): Promise<WhatsAppTemplate[]> {
    return prisma.whatsAppTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  async findTemplateByName(name: string): Promise<WhatsAppTemplate | null> {
    return prisma.whatsAppTemplate.findUnique({ where: { name } });
  }

  async updateTemplate(name: string, data: { category?: string }): Promise<void> {
    await prisma.whatsAppTemplate.update({ where: { name }, data });
  }

  async getTemplateUsageAggregated(from?: Date, to?: Date): Promise<AggregatedTemplateUsage[]> {
    const result = await prisma.whatsAppTemplateUsage.groupBy({
      by: ['templateName', 'category'],
      where: { createdAt: { gte: from, lte: to } },
      _count: { id: true },
      _sum: { costUsd: true },
    });
    return result.map(r => ({
      templateName: r.templateName,
      category: r.category,
      totalSent: r._count.id,
      totalCostUsd: r._sum.costUsd ?? 0,
    }));
  }

  async getServiceConversationTotal(from?: Date, to?: Date): Promise<{ totalConversations: number; totalCostUsd: number }> {
    const result = await prisma.whatsAppServiceConversation.aggregate({
      where: { createdAt: { gte: from, lte: to } },
      _count: { id: true },
      _sum: { costUsd: true },
    });
    return {
      totalConversations: result._count.id,
      totalCostUsd: result._sum.costUsd ?? 0,
    };
  }

  async getAvgCostPerRequest(from?: Date, to?: Date): Promise<number> {
    const result = await prisma.$queryRaw<{ uniqueRequests: bigint; totalCost: number }[]>`
      SELECT
        COUNT(DISTINCT "requestId") as "uniqueRequests",
        SUM("costUsd") as "totalCost"
      FROM (
        SELECT "requestId", "costUsd" FROM "WhatsAppTemplateUsage"
        WHERE "requestId" IS NOT NULL
          AND "createdAt" >= ${from ?? new Date(0)}
          AND "createdAt" <= ${to ?? new Date()}
        UNION ALL
        SELECT "requestId", "costUsd" FROM "WhatsAppServiceConversation"
        WHERE "requestId" IS NOT NULL
          AND "createdAt" >= ${from ?? new Date(0)}
          AND "createdAt" <= ${to ?? new Date()}
      ) combined
    `;
    const row = result[0];
    if (!row || Number(row.uniqueRequests) === 0) return 0;
    return row.totalCost / Number(row.uniqueRequests);
  }

  async getCostsByDay(from?: Date, to?: Date): Promise<{ date: string; templateCostUsd: number; serviceCostUsd: number }[]> {
    const result = await prisma.$queryRaw<{ date: Date; templateCostUsd: number; serviceCostUsd: number }[]>`
      SELECT
        DATE_TRUNC('day', day) as date,
        COALESCE(SUM(template_cost), 0) as "templateCostUsd",
        COALESCE(SUM(service_cost), 0) as "serviceCostUsd"
      FROM (
        SELECT DATE_TRUNC('day', "createdAt") as day, "costUsd" as template_cost, 0 as service_cost
        FROM "WhatsAppTemplateUsage"
        WHERE "createdAt" >= ${from ?? new Date(0)} AND "createdAt" <= ${to ?? new Date()}
        UNION ALL
        SELECT DATE_TRUNC('day', "createdAt") as day, 0 as template_cost, "costUsd" as service_cost
        FROM "WhatsAppServiceConversation"
        WHERE "createdAt" >= ${from ?? new Date(0)} AND "createdAt" <= ${to ?? new Date()}
      ) combined
      GROUP BY DATE_TRUNC('day', day)
      ORDER BY date ASC
    `;
    return result.map(r => ({
      date: r.date.toISOString().split('T')[0],
      templateCostUsd: r.templateCostUsd,
      serviceCostUsd: r.serviceCostUsd,
    }));
  }
}
