import { AdminRepository } from './admin.repository';

export interface AdminMetrics {
  orders: {
    active: number;
    last24h: number;
    last7d: number;
    total: number;
  };
  acceptanceRate: number;
  coverageRate: number;
  avgAcceptanceTimeMinutes: number | null;
  professionals: {
    active: number;
    pending: number;
    suspended: number;
    total: number;
  };
  escalations: {
    open: number;
    total: number;
  };
  wouldRecommendPct: number;
  ordersByStatus: { status: string; count: number }[];
  ordersLast30Days: { date: string; count: number }[];
  professionalsByStatus: { status: string; count: number }[];
}

export class AdminService {
  constructor(private readonly adminRepository: AdminRepository) {}

  async getMetrics(): Promise<AdminMetrics> {
    const [
      orderCounts,
      recentCounts,
      professionalCounts,
      escalationCounts,
      feedbackStats,
      acceptanceStats,
      ordersLast30Days,
    ] = await Promise.all([
      this.adminRepository.countOrdersByStatus(),
      this.adminRepository.countRecentOrders(),
      this.adminRepository.countProfessionalsByStatus(),
      this.adminRepository.countEscalationsByStatus(),
      this.adminRepository.getFeedbackStats(),
      this.adminRepository.getAcceptanceStats(),
      this.adminRepository.getOrdersLast30Days(),
    ]);

    const activeOrders =
      (orderCounts.find((o) => o.status === 'CREATED')?._count ?? 0) +
      (orderCounts.find((o) => o.status === 'ASSIGNED')?._count ?? 0) +
      (orderCounts.find((o) => o.status === 'ACCEPTED')?._count ?? 0);

    const totalOrders = orderCounts.reduce((sum, o) => sum + o._count, 0);

    const acceptedCount =
      orderCounts.find((o) => o.status === 'ACCEPTED')?._count ?? 0;
    const completedCount =
      orderCounts.find((o) => o.status === 'COMPLETED')?._count ?? 0;
    const resolvedTotal = acceptedCount + completedCount;

    const acceptanceRate =
      totalOrders > 0 ? resolvedTotal / totalOrders : 0;

    const coverageRate =
      totalOrders > 0
        ? (activeOrders + completedCount) / totalOrders
        : 0;

    const avgAcceptanceTimeMinutes = acceptanceStats?._avg?.acceptanceTimeMinutes
      ? Math.round(acceptanceStats._avg.acceptanceTimeMinutes)
      : null;

    const activeProfessionals =
      professionalCounts.find(
        (p) => p.status === 'ACTIVE' || p.status === 'PAUSED',
      )?._count ?? 0;
    const pendingProfessionals =
      (professionalCounts.find((p) => p.status === 'PENDING')?._count ?? 0) +
      (professionalCounts.find((p) => p.status === 'UNDER_REVIEW')?._count ?? 0) +
      (professionalCounts.find((p) => p.status === 'OBSERVATION')?._count ?? 0);
    const suspendedProfessionals =
      professionalCounts.find((p) => p.status === 'SUSPENDED')?._count ?? 0;
    const totalProfessionals = professionalCounts.reduce(
      (sum, p) => sum + p._count,
      0,
    );

    const openEscalations =
      escalationCounts.find((e) => e.status === 'OPEN')?._count ?? 0;
    const totalEscalations = escalationCounts.reduce(
      (sum, e) => sum + e._count,
      0,
    );

    const wouldRecommend =
      feedbackStats._count > 0
        ? Math.round(
            (feedbackStats.wouldRecommendTrue / feedbackStats._count) * 100,
          )
        : 0;

    return {
      orders: {
        active: activeOrders,
        last24h: recentCounts.last24h,
        last7d: recentCounts.last7d,
        total: totalOrders,
      },
      acceptanceRate: Math.round(acceptanceRate * 100),
      coverageRate: Math.round(coverageRate * 100),
      avgAcceptanceTimeMinutes,
      professionals: {
        active: activeProfessionals,
        pending: pendingProfessionals,
        suspended: suspendedProfessionals,
        total: totalProfessionals,
      },
      escalations: {
        open: openEscalations,
        total: totalEscalations,
      },
      wouldRecommendPct: wouldRecommend,
      ordersByStatus: orderCounts.map((o) => ({
        status: o.status,
        count: o._count,
      })),
      ordersLast30Days,
      professionalsByStatus: professionalCounts.map((p) => ({
        status: p.status,
        count: p._count,
      })),
    };
  }
}
