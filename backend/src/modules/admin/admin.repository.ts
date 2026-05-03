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

export class AdminRepository {
  async countOrdersByStatus(): Promise<CountByStatus[]> {
    const result = await prisma.request.groupBy({
      by: ['status'],
      _count: true,
    });

    return result;
  }

  async countRecentOrders(): Promise<RecentCounts> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [count24h, count7d] = await Promise.all([
      prisma.request.count({ where: { createdAt: { gte: last24h } } }),
      prisma.request.count({ where: { createdAt: { gte: last7d } } }),
    ]);

    return { last24h: count24h, last7d: count7d };
  }

  async countProfessionalsByStatus(): Promise<CountByStatus[]> {
    const result = await prisma.professional.groupBy({
      by: ['status'],
      _count: true,
    });

    return result;
  }

  async countEscalationsByStatus(): Promise<CountByStatus[]> {
    const result = await prisma.escalation.groupBy({
      by: ['status'],
      _count: true,
    });

    return result;
  }

  async getFeedbackStats(): Promise<FeedbackAggregate> {
    const result = await prisma.feedback.aggregate({
      _count: true,
    });

    const wouldRecommendTrue = await prisma.feedback.count({
      where: { wouldRecommend: true },
    });

    return { _count: result._count, wouldRecommendTrue };
  }

  async getAcceptanceStats(): Promise<AcceptanceAggregate> {
    const accepted = await prisma.request.findMany({
      where: {
        status: { in: ['ACCEPTED'] },
        assignedAt: { not: null },
        acceptedAt: { not: null },
      },
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
}
