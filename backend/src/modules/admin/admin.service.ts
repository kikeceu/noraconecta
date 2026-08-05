import { AdminRepository } from './admin.repository';
import { ConfigRepository } from '../config/config.repository';
import { LLMService } from '../llm/llm.service';
import { LLMCostsResponse } from '../llm/llm.service';
import { WhatsAppUsageService } from '../whatsapp/whatsapp.service';
import { WhatsAppCostsResponse } from '../whatsapp/whatsapp.service';
import { WhatsAppTemplate } from '@prisma/client';
import { AppError } from '../../middleware/error-handler';

export interface MembershipDiscount {
  active: boolean;
  discountPct: number;
  expiresAt: string | null;
}

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
  unfulfilledDemand: { categoryName: string; geoNodeName: string; count: number }[];
}

export interface DemandInsights {
  byCategory: {
    categoryName: string;
    geoNodeName: string;
    count: number;
    lastDate: string;
  }[];
  total: number;
  totalCategories: number;
}

export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly configRepository: ConfigRepository,
    private readonly llmService: LLMService,
    private readonly whatsAppUsageService?: WhatsAppUsageService,
  ) {}

  async getMembershipDiscount(): Promise<MembershipDiscount> {
    const [activeConfig, pctConfig, expiresConfig] = await Promise.all([
      this.configRepository.findByKey('MEMBERSHIP_DISCOUNT_ACTIVE'),
      this.configRepository.findByKey('MEMBERSHIP_DISCOUNT_PCT'),
      this.configRepository.findByKey('MEMBERSHIP_DISCOUNT_EXPIRES_AT'),
    ]);

    const active = activeConfig?.value === 'true';
    const discountPct = parseInt(pctConfig?.value ?? '0', 10);
    const expiresAt = expiresConfig?.value ?? null;

    if (active && expiresAt && new Date(expiresAt) < new Date()) {
      return { active: false, discountPct: 0, expiresAt: null };
    }

    return { active, discountPct, expiresAt };
  }

  async setMembershipDiscount(
    active: boolean,
    discountPct?: number,
    durationHours?: number,
  ): Promise<void> {
    if (!active) {
      await this.configRepository.upsert('MEMBERSHIP_DISCOUNT_ACTIVE', 'false');
      return;
    }

    if (!discountPct || !durationHours) {
      throw new AppError('discountPct y durationHours son requeridos para activar el descuento', 400);
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    await Promise.all([
      this.configRepository.upsert('MEMBERSHIP_DISCOUNT_ACTIVE', 'true'),
      this.configRepository.upsert('MEMBERSHIP_DISCOUNT_PCT', String(discountPct)),
      this.configRepository.upsert('MEMBERSHIP_DISCOUNT_EXPIRES_AT', expiresAt.toISOString()),
    ]);
  }

  async getMetrics(geoNodeId?: string): Promise<AdminMetrics> {
    const [
      orderCounts,
      recentCounts,
      professionalCounts,
      escalationCounts,
      feedbackStats,
      acceptanceStats,
      ordersLast30Days,
      unfulfilledDemand,
    ] = await Promise.all([
      this.adminRepository.countOrdersByStatus(geoNodeId),
      this.adminRepository.countRecentOrders(geoNodeId),
      this.adminRepository.countProfessionalsByStatus(geoNodeId),
      this.adminRepository.countEscalationsByStatus(geoNodeId),
      this.adminRepository.getFeedbackStats(geoNodeId),
      this.adminRepository.getAcceptanceStats(geoNodeId),
      this.adminRepository.getOrdersLast30Days(geoNodeId),
      this.adminRepository.getUnfulfilledDemand(geoNodeId),
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
      unfulfilledDemand,
    };
  }

  async getGeoTree(): Promise<{
    provinces: { id: string; name: string; departments: { id: string; name: string }[] }[];
  }> {
    return this.adminRepository.getGeoTree();
  }

  async getDemandInsights(geoNodeId?: string): Promise<DemandInsights> {
    const byCategory = await this.adminRepository.getDemandInsights(geoNodeId);

    return {
      byCategory,
      total: byCategory.reduce((acc, item) => acc + item.count, 0),
      totalCategories: new Set(byCategory.map((item) => item.categoryName)).size,
    };
  }

  async getLLMCosts(from?: Date, to?: Date): Promise<LLMCostsResponse> {
    return this.llmService.getCosts(from, to);
  }

  async getWhatsAppCosts(from?: Date, to?: Date): Promise<WhatsAppCostsResponse | null> {
    if (!this.whatsAppUsageService) return null;
    return this.whatsAppUsageService.getCosts(from, to);
  }

  async getWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
    if (!this.whatsAppUsageService) return [];
    return this.whatsAppUsageService.getTemplateCatalog();
  }

  async updateWhatsAppTemplate(name: string, data: { category?: string }): Promise<void> {
    if (!this.whatsAppUsageService) throw new AppError('WhatsApp service not available', 500);
    await this.whatsAppUsageService.updateTemplate(name, data);
  }
}
