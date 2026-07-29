import prisma from '../../lib/prisma';

interface CountByStatus {
  status: string;
  _count: number;
}

interface RecentCounts {
  last24h: number;
  last7d: number;
}

interface FeedbackAggregate {
  _count: number;
  wouldRecommendTrue: number;
}

interface AcceptanceAggregate {
  _avg: {
    acceptanceTimeMinutes: number | null;
  } | null;
}

interface UnfulfilledDemandItem {
  categoryName: string;
  geoNodeName: string;
  count: number;
}

interface DemandInsightItem {
  categoryName: string;
  geoNodeName: string;
  count: number;
  lastDate: string;
}

export class AdminRepository {
  async countOrdersByStatus(geoNodeId?: string): Promise<CountByStatus[]> {
    const result = await prisma.request.groupBy({
      by: ['status'],
      _count: true,
      where: geoNodeId ? { geoNodeId } : undefined,
    });

    return result;
  }

  async countRecentOrders(geoNodeId?: string): Promise<RecentCounts> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const baseWhere = geoNodeId ? { geoNodeId } : {};

    const [count24h, count7d] = await Promise.all([
      prisma.request.count({ where: { ...baseWhere, createdAt: { gte: last24h } } }),
      prisma.request.count({ where: { ...baseWhere, createdAt: { gte: last7d } } }),
    ]);

    return { last24h: count24h, last7d: count7d };
  }

  async getOrdersLast30Days(geoNodeId?: string): Promise<{ date: string; count: number }[]> {
    const days: { date: string; count: number }[] = [];
    const now = new Date();
    const baseWhere = geoNodeId ? { geoNodeId } : {};

    for (let i = 29; i >= 0; i--) {
      const from = new Date(now);
      from.setDate(from.getDate() - i);
      from.setHours(0, 0, 0, 0);

      const to = new Date(from);
      to.setHours(23, 59, 59, 999);

      const count = await prisma.request.count({
        where: { ...baseWhere, createdAt: { gte: from, lte: to } },
      });

      days.push({
        date: from.toISOString().split('T')[0],
        count,
      });
    }

    return days;
  }

  async countProfessionalsByStatus(geoNodeId?: string): Promise<CountByStatus[]> {
    const result = await prisma.professional.groupBy({
      by: ['status'],
      _count: true,
      where: geoNodeId ? { zones: { some: { geoNodeId } } } : undefined,
    });

    return result;
  }

  async countEscalationsByStatus(geoNodeId?: string): Promise<CountByStatus[]> {
    const result = await prisma.escalation.groupBy({
      by: ['status'],
      _count: true,
      where: geoNodeId ? { request: { geoNodeId } } : undefined,
    });

    return result;
  }

  async getFeedbackStats(geoNodeId?: string): Promise<FeedbackAggregate> {
    const where = geoNodeId ? { request: { geoNodeId } } : {};

    const result = await prisma.feedback.aggregate({
      _count: true,
      where,
    });

    const wouldRecommendTrue = await prisma.feedback.count({
      where: { ...where, wouldRecommend: true },
    });

    return { _count: result._count, wouldRecommendTrue };
  }

  async getAcceptanceStats(geoNodeId?: string): Promise<AcceptanceAggregate> {
    const where: Record<string, unknown> = {
      status: { in: ['ACCEPTED'] },
      assignedAt: { not: null },
      acceptedAt: { not: null },
    };
    if (geoNodeId) where.geoNodeId = geoNodeId;

    const accepted = await prisma.request.findMany({
      where,
      select: {
        assignedAt: true,
        acceptedAt: true,
      },
    });

    if (accepted.length === 0) {
      return { _avg: null };
    }

    const totalMinutes = accepted.reduce((sum, r) => {
      if (!r.assignedAt || !r.acceptedAt) return sum;
      return sum + (r.acceptedAt.getTime() - r.assignedAt.getTime()) / 60000;
    }, 0);

    return {
      _avg: {
        acceptanceTimeMinutes: Math.round(totalMinutes / accepted.length),
      },
    };
  }

  async getUnfulfilledDemand(
    geoNodeId?: string,
  ): Promise<UnfulfilledDemandItem[]> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const grouped = await prisma.request.groupBy({
      by: ['categoryId', 'geoNodeId'],
      where: {
        status: 'NOT_FULFILLED',
        createdAt: { gte: since },
        ...(geoNodeId ? { geoNodeId } : {}),
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    if (grouped.length === 0) {
      return [];
    }

    const categoryIds = [...new Set(grouped.map((item) => item.categoryId))];
    const geoNodeIds = [...new Set(grouped.map((item) => item.geoNodeId))];

    const [categories, geoNodes] = await Promise.all([
      prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      }),
      prisma.geoNode.findMany({
        where: { id: { in: geoNodeIds } },
        select: { id: true, name: true },
      }),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const geoNodeMap = new Map(geoNodes.map((g) => [g.id, g.name]));

    return grouped.map((item) => ({
      categoryName: categoryMap.get(item.categoryId) ?? 'Desconocido',
      geoNodeName: geoNodeMap.get(item.geoNodeId) ?? 'Desconocido',
      count: item._count.id,
    }));
  }

  async getDemandInsights(geoNodeId?: string): Promise<DemandInsightItem[]> {
    const grouped = await prisma.request.groupBy({
      by: ['categoryId', 'geoNodeId'],
      where: {
        status: 'NOT_FULFILLED',
        ...(geoNodeId ? { geoNodeId } : {}),
      },
      _count: { id: true },
      _max: { createdAt: true },
      orderBy: { _count: { id: 'desc' } },
    });

    if (grouped.length === 0) {
      return [];
    }

    const categoryIds = [...new Set(grouped.map((item) => item.categoryId))];
    const geoNodeIds = [...new Set(grouped.map((item) => item.geoNodeId))];

    const [categories, geoNodes] = await Promise.all([
      prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      }),
      prisma.geoNode.findMany({
        where: { id: { in: geoNodeIds } },
        select: { id: true, name: true },
      }),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const geoNodeMap = new Map(geoNodes.map((g) => [g.id, g.name]));

    return grouped.map((item) => ({
      categoryName: categoryMap.get(item.categoryId) ?? 'Desconocido',
      geoNodeName: geoNodeMap.get(item.geoNodeId) ?? 'Desconocido',
      count: item._count.id,
      lastDate: item._max.createdAt?.toISOString() ?? '',
    }));
  }

  async getGeoTree(): Promise<{
    provinces: { id: string; name: string; departments: { id: string; name: string }[] }[];
  }> {
    const provinces = await prisma.geoNode.findMany({
      where: { level: { level: 1 }, isActive: true },
      select: {
        id: true,
        name: true,
        children: {
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      provinces: provinces.map((p) => ({
        id: p.id,
        name: p.name,
        departments: p.children,
      })),
    };
  }
}
