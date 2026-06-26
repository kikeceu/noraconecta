import { randomUUID } from 'crypto';
import {
  ProfessionalsRepository,
  ProfessionalFilters,
} from './professionals.repository';
import { ReputationService } from '../reputation/reputation.service';
import { ReputationRepository } from '../reputation/reputation.repository';
import { ConfigRepository } from '../config/config.repository';
import { BotRepository } from '../bot/bot.repository';
import { AppError } from '../../middleware/error-handler';
import { Professional, ProfessionalStatus, LicenseStatus, Prisma } from '@prisma/client';
import { WhatsAppAdapter, WhatsAppRole } from '../../lib/whatsapp-adapter';
import { shouldUseTemplate } from '../../utils/whatsapp-utils';
import { LICENSE_REJECTED_TEMPLATE } from '../../utils/whatsapp-templates';
import { MembershipsService } from '../memberships/memberships.service';

const VERIFICATION_TOKEN_TTL_HOURS = 168; // 7 days
const SESSION_TOKEN_TTL_DAYS = 30;

const APP_URL = process.env.APP_URL || 'http://app.noraconecta.local';

export interface PaginatedProfessionalsResponse {
  data: Professional[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type VerificationStageTwoInput = {
  dniNumber?: string;
  dniFrontUrl?: string;
  dniBackUrl?: string;
  cuil?: string;
  criminalRecordUrl?: string;
  references?: string;
  presentationVideoUrl?: string;
  zoneIds?: string[];
  licenseUrl?: string;
};

function canReceiveRequests(professional: Professional): boolean {
  return professional.status === 'ACTIVE';
}

function notifyProfessionalPendingReview(professional: Professional): void {
  // TODO: Replace with proper notification system (event bus, webhook, etc.)
  // eslint-disable-next-line no-console
  console.log(
    `[NOTIFICATION] PROFESSIONAL_PENDING_REVIEW: ${professional.id} - ${professional.name}`,
  );
}

const reputationRepository = new ReputationRepository();

export class ProfessionalsService {
  private readonly reputationService: ReputationService;

  constructor(
    private readonly professionalsRepository: ProfessionalsRepository,
    private readonly whatsappAdapter: WhatsAppAdapter,
    private readonly configRepository: ConfigRepository,
    private readonly botRepository: BotRepository,
    private readonly membershipsService: MembershipsService,
  ) {
    this.reputationService = new ReputationService(reputationRepository);
  }

  async register(
    phone: string,
    name: string,
    categoryId: string,
    latitude?: number,
    longitude?: number,
  ): Promise<{ professional: Professional; verificationUrl: string }> {
    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();

    if (!trimmedPhone) {
      throw new AppError('Phone is required', 400);
    }

    if (!trimmedName) {
      throw new AppError('Name is required', 400);
    }

    if (!categoryId) {
      throw new AppError('Category is required', 400);
    }

    const existingByPhone = await this.professionalsRepository.findByPhone(trimmedPhone);

    if (existingByPhone) {
      throw new AppError('A professional with this phone already exists', 409);
    }

    const verificationToken = randomUUID();
    const verificationTokenExp = new Date(
      Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );

    const professional = await this.professionalsRepository.create({
      phone: trimmedPhone,
      name: trimmedName,
      categoryId,
      verificationToken,
      verificationTokenExp,
      latitude,
      longitude,
    });

    const verificationUrl = `${APP_URL}/verify/${verificationToken}`;

    return { professional, verificationUrl };
  }

  async getVerificationTokenStatus(token: string): Promise<{
    valid: boolean;
    professionalName?: string;
    zones?: { id: string; name: string }[];
    requiresLicense?: boolean;
    licenseLabel?: string | null;
    declaredHasLicense?: boolean | null;
  }> {
    if (!token) {
      throw new AppError('Verification token is required', 400);
    }

    const professional = await this.professionalsRepository.findByVerificationToken(token);

    if (!professional) {
      throw new AppError('Verification token not found', 404);
    }

    if (professional.verificationTokenUsed) {
      throw new AppError('Verification token has already been used', 400);
    }

    if (new Date() > professional.verificationTokenExp) {
      throw new AppError('Verification token has expired', 400);
    }

    return {
      valid: true,
      professionalName: professional.name,
      zones: professional.zones.map((z) => ({
        id: z.geoNode.id,
        name: z.geoNode.name,
      })),
      requiresLicense: professional.category?.requiresLicense ?? false,
      licenseLabel: professional.category?.licenseLabel ?? null,
      declaredHasLicense: professional.declaredHasLicense ?? null,
    };
  }

  async submitVerification(
    token: string,
    data: VerificationStageTwoInput,
  ): Promise<Professional> {
    if (!token) {
      throw new AppError('Verification token is required', 400);
    }

    const professional = await this.professionalsRepository.findByVerificationToken(token);

    if (!professional) {
      throw new AppError('Verification token not found', 404);
    }

    if (professional.verificationTokenUsed) {
      throw new AppError('Verification token has already been used', 400);
    }

    if (new Date() > professional.verificationTokenExp) {
      throw new AppError('Verification token has expired', 400);
    }

    const { zoneIds, ...updateData } = data;

    const updated = await this.professionalsRepository.update(professional.id, {
      ...updateData,
      status: 'UNDER_REVIEW',
      verificationTokenUsed: true,
    });

    if (zoneIds !== undefined) {
      await this.professionalsRepository.deleteAllZones(professional.id);
      for (const zoneId of zoneIds) {
        await this.professionalsRepository.addZone(professional.id, zoneId);
      }
    }

    notifyProfessionalPendingReview(updated);

    return updated;
  }

  async approve(id: string): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.status !== 'UNDER_REVIEW') {
      throw new AppError(
        `Cannot approve a professional with status ${professional.status}. Expected UNDER_REVIEW`,
        400,
      );
    }

    const approvedProfessional = await this.professionalsRepository.updateStatus(id, 'ACTIVE');

    const trialRequestsLimitConfig = await this.configRepository.findByKey(
      'TRIAL_REQUESTS_LIMIT',
    );
    const parsedTrialRequestsLimit = Number.parseInt(
      trialRequestsLimitConfig?.value ?? '',
      10,
    );
    const trialRequestsLimit =
      Number.isFinite(parsedTrialRequestsLimit) && parsedTrialRequestsLimit > 0
        ? parsedTrialRequestsLimit
        : 3;

    const welcomeMessage = `¡Bienvenido a NORA, ${approvedProfessional.name}! 🎉 Ya sos parte de nuestra red de profesionales de confianza.\n\nTu posición en la red depende de tu actividad:\n• Responder rápido\n• Aceptar pedidos\n• Completar trabajos bien\n\nLos que no responden, bajan en el ranking.\n\nTenés *${trialRequestsLimit} pedidos gratuitos* para comenzar. ¡Mucho éxito!`;

    try {
      const needsTemplate = await shouldUseTemplate(
        approvedProfessional.phone,
        'PROFESSIONAL',
        this.botRepository,
      );

console.log('[approve] needsTemplate:', needsTemplate, 'phone:', approvedProfessional.phone);
      if (needsTemplate) {
        await this.whatsappAdapter.sendTemplate(
          approvedProfessional.phone,
          'nora_pro_bienvenida',
          [approvedProfessional.name, String(trialRequestsLimit)],
          'PROFESSIONAL',
        );
      } else {
        await this.whatsappAdapter.sendText(
          approvedProfessional.phone,
          welcomeMessage,
          'PROFESSIONAL',
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '[ProfessionalsService.approve] Failed to send approval notification:',
        error,
      );
    }

    return approvedProfessional;
  }

  async reject(id: string, reason?: string): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.status !== 'UNDER_REVIEW') {
      throw new AppError(
        `Cannot reject a professional with status ${professional.status}. Expected UNDER_REVIEW`,
        400,
      );
    }

    // eslint-disable-next-line no-console
    console.log(`[REJECTION] Professional ${id} rejected. Reason: ${reason || 'N/A'}`);

    return this.professionalsRepository.updateStatus(id, 'REJECTED');
  }

  async suspend(id: string): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.status === 'SUSPENDED') {
      throw new AppError('Professional is already suspended', 409);
    }

    return this.professionalsRepository.updateStatus(id, 'SUSPENDED');
  }

  async reactivate(id: string): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.status !== 'SUSPENDED') {
      throw new AppError(
        `Cannot reactivate a professional with status ${professional.status}. Expected SUSPENDED`,
        400,
      );
    }

    return this.professionalsRepository.updateStatus(id, 'ACTIVE');
  }

  async setBadge(id: string, hasBadge: boolean): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.hasBadge === hasBadge) {
      throw new AppError(
        `Badge is already ${hasBadge ? 'enabled' : 'disabled'}`,
        409,
      );
    }

    return this.professionalsRepository.setBadge(id, hasBadge);
  }

  async generateSessionToken(id: string): Promise<{
    professional: Professional;
    sessionToken: string;
    panelUrl: string;
  }> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.status !== 'ACTIVE') {
      throw new AppError(
        `Cannot generate session token for a professional with status ${professional.status}. Expected ACTIVE`,
        400,
      );
    }

    const sessionToken = randomUUID();
    const sessionTokenExp = new Date(
      Date.now() + SESSION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const updated = await this.professionalsRepository.setSessionToken(
      id,
      sessionToken,
      sessionTokenExp,
    );

    return { professional: updated, sessionToken, panelUrl: `${APP_URL}/panel/${sessionToken}` };
  }

  async getSessionByToken(token: string): Promise<Professional> {
    if (!token) {
      throw new AppError('Session token is required', 400);
    }

    const professional = await this.professionalsRepository.findBySessionToken(token);

    if (!professional) {
      throw new AppError('Session token not found', 404);
    }

    if (!professional.sessionTokenExp || new Date() > professional.sessionTokenExp) {
      throw new AppError('Session token has expired', 401);
    }

    return professional;
  }

  async getPanelData(token: string) {
    const professional = await this.getSessionByToken(token);

    const panelData = await this.professionalsRepository.findPanelData(professional.id);

    const statusCounts: Record<string, number> = {};
    for (const group of panelData.requestStats) {
      statusCounts[group.status] = group._count.id;
    }

    const completed = statusCounts['COMPLETED'] || 0;
    const rejected = statusCounts['REJECTED'] || 0;
    const notFulfilled = statusCounts['NOT_FULFILLED'] || 0;
    const accepted = statusCounts['ACCEPTED'] || 0;
    const total = completed + rejected + notFulfilled + accepted;
    const decidedTotal = completed + notFulfilled;
    const complianceScore = decidedTotal > 0 ? Math.round((completed / decidedTotal) * 100) : 0;

    const trialRequestsLimitConfig = await this.configRepository.findByKey(
      'TRIAL_REQUESTS_LIMIT',
    );
    const trialRequestsLimit = trialRequestsLimitConfig?.value
      ? parseInt(trialRequestsLimitConfig.value, 10) || 5
      : 5;

    const [reputationBreakdown, userComments] = await Promise.all([
      this.reputationService.getReputationBreakdown(professional.id),
      this.reputationService.getUserComments(professional.id),
    ]);

    return {
      professional: {
        id: panelData.professional!.id,
        name: panelData.professional!.name,
        phone: panelData.professional!.phone,
        status: panelData.professional!.status,
        category: panelData.professional!.category,
        zones: panelData.professional!.zones.map((z) => ({
          id: z.geoNode.id,
          name: z.geoNode.name,
        })),
        availability: panelData.professional!.availability,
        hasBadge: panelData.professional!.hasBadge,
        dniFrontUrl: panelData.professional!.dniFrontUrl,
        dniBackUrl: panelData.professional!.dniBackUrl,
        criminalRecordUrl: panelData.professional!.criminalRecordUrl,
        cuil: panelData.professional!.cuil,
        references: panelData.professional!.references,
        presentationVideoUrl: panelData.professional!.presentationVideoUrl,
        dniNumber: panelData.professional!.dniNumber,
        licenseUrl: panelData.professional!.licenseUrl,
        declaredHasLicense: panelData.professional!.declaredHasLicense,
        availabilityStructured: panelData.professional!.availabilityStructured,
      },
      membership: {
        activeMembership: panelData.membership,
        trialRequestsUsed: panelData.professional!.trialRequestsUsed,
        trialRequestsLimit,
      },
      reputation: {
        complianceScore,
        completedRequests: completed,
        rejectedRequests: rejected,
        notFulfilledRequests: notFulfilled,
        totalRequests: total,
        wouldRecommendPct: reputationBreakdown.wouldRecommendPct,
        averageRating: reputationBreakdown.averageRating,
        averagePunctuality: reputationBreakdown.averagePunctuality,
        averageQuality: reputationBreakdown.averageQuality,
        averageCommunication: reputationBreakdown.averageCommunication,
        averagePriceFairness: reputationBreakdown.averagePriceFairness,
        totalRated: reputationBreakdown.totalRated,
        userComments,
      },
    };
  }

  async getPanelOrders(
    token: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const professional = await this.getSessionByToken(token);

    const validPage = Math.max(1, page);
    const validLimit = Math.min(50, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    const { orders, total } = await this.professionalsRepository.findOrdersByProfessionalId(
      professional.id,
      skip,
      validLimit,
    );

    return {
      data: orders.map((order) => {
        const firstEvent = (
          order as { events?: Array<{ type: string }> }
        ).events?.[0];

        const feedback = order.feedback;
        const userRatingAvg = feedback?.ratedByUserAt
          ? parseFloat(
              (
                ((feedback.punctualityRating ?? 0) +
                  (feedback.qualityRating ?? 0) +
                  (feedback.communicationRating ?? 0) +
                  (feedback.priceFairnessRating ?? 0)) / 4
              ).toFixed(1)
            )
          : null;

        const userRatingDetail = feedback?.ratedByUserAt
          ? {
              punctualityRating: feedback.punctualityRating!,
              qualityRating: feedback.qualityRating!,
              communicationRating: feedback.communicationRating!,
              priceFairnessRating: feedback.priceFairnessRating!,
              userComment: feedback.userComment ?? null,
            }
          : null;

        const professionalRatingDetail = feedback?.ratedByProfessionalAt
          ? {
              requestClarityRating: feedback.requestClarityRating!,
              userAvailabilityRating: feedback.userAvailabilityRating!,
              userTreatmentRating: feedback.userTreatmentRating!,
              wouldServeAgain: feedback.wouldServeAgain!,
              professionalComment: feedback.professionalComment ?? null,
            }
          : null;

        return {
          id: order.id,
          createdAt: order.createdAt,
          status: order.status,
          professionalEventType: firstEvent?.type ?? null,
          description: order.description,
          userName: order.user?.name || null,
          userPhone: order.user?.phone || null,
          category: order.category ? { id: order.category.id, name: order.category.name } : null,
          geoNode: order.geoNode ? { id: order.geoNode.id, name: order.geoNode.name } : null,
          ratedByProfessional:
            order.feedback?.ratedByProfessionalAt !== null
            && order.feedback?.ratedByProfessionalAt !== undefined,
          ratedByUser:
            order.feedback?.ratedByUserAt !== null
            && order.feedback?.ratedByUserAt !== undefined,
          userRatingAvg,
          userRatingDetail,
          professionalRatingDetail,
          coordinationStatus: order.coordinationStatus,
          clientAvailability: order.clientAvailability,
          clientAddress: order.clientAddress,
          userLatitude: order.userLatitude,
          userLongitude: order.userLongitude,
          scheduledAt: order.scheduledAt,
          photoUrls: order.photoUrls,
          audioUrl: order.audioUrl,
        };
      }),
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  async getPendingRequests(token: string): Promise<{
    data: {
      id: string;
      category: { id: string; name: string } | null;
      geoNode: { id: string; name: string } | null;
      description: string;
      createdAt: Date;
      assignmentTimeoutAt: Date | null;
      userName: string | null;
      photoUrls: string[];
      audioUrl: string | null;
    }[];
  }> {
    const professional = await this.getSessionByToken(token);

    const pendingRequests = await this.professionalsRepository.findPendingRequestsByProfessionalId(
      professional.id,
    );

    return {
      data: pendingRequests.map((request) => ({
        id: request.id,
        category: request.category
          ? { id: request.category.id, name: request.category.name }
          : null,
        geoNode: request.geoNode
          ? { id: request.geoNode.id, name: request.geoNode.name }
          : null,
        description: request.description,
        createdAt: request.createdAt,
        assignmentTimeoutAt: request.assignmentTimeoutAt,
        userName: request.user?.name ?? null,
        photoUrls: request.photoUrls,
        audioUrl: request.audioUrl,
      })),
    };
  }

  async getActivityStats(token: string, days: number) {
    const professional = await this.getSessionByToken(token);

    const { recentEvents, recentFeedback } =
      await this.professionalsRepository.findActivityStats(professional.id, days);

    const dailyActivity: {
      date: string;
      completed: number;
      cancelled: number;
      notFulfilled: number;
    }[] = [];

    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      dailyActivity.push({ date: dateStr, completed: 0, cancelled: 0, notFulfilled: 0 });
    }

    for (const event of recentEvents) {
      const dateStr = event.createdAt.toISOString().slice(0, 10);
      const day = dailyActivity.find((d) => d.date === dateStr);
      if (!day) continue;

      if (event.type === 'COMPLETED') day.completed++;
      else if (event.type === 'CANCELLED') day.cancelled++;
      else if (event.type === 'NOT_FULFILLED') day.notFulfilled++;
    }

    const weekCount = Math.ceil(days / 7);

    const weeks: { start: Date; end: Date }[] = [];
    for (let i = weekCount - 1; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weeks.push({ start: weekStart, end: weekEnd });
    }

    const ratingEvolution = weeks.map((week, idx) => {
      const weekFeedbacks = recentFeedback.filter((fb) => {
        if (!fb.ratedByUserAt) return false;
        const fbDate = new Date(fb.ratedByUserAt);
        return fbDate >= week.start && fbDate <= week.end;
      });

      const rated = weekFeedbacks.filter(
        (fb) =>
          fb.punctualityRating != null &&
          fb.qualityRating != null &&
          fb.communicationRating != null &&
          fb.priceFairnessRating != null,
      );

      const totalRated = rated.length;

      let averageRating: number | null = null;

      if (totalRated > 0) {
        const sum = rated.reduce(
          (acc, fb) =>
            acc +
            (fb.punctualityRating! +
              fb.qualityRating! +
              fb.communicationRating! +
              fb.priceFairnessRating!) /
              4,
          0,
        );
        averageRating = parseFloat((sum / totalRated).toFixed(1));
      }

      return {
        weekLabel: `Sem ${idx + 1}`,
        averageRating,
        totalRated,
      };
    });

    return {
      data: {
        weeklyActivity: dailyActivity,
        ratingEvolution,
        weekCount,
      },
    };
  }

  async getEarnings(
    token: string,
    days: number,
  ): Promise<{ totalEarnings: number; days: number }> {
    const professional = await this.getSessionByToken(token);
    const validDays = [7, 15, 30].includes(days) ? days : 30;
    const totalEarnings = await this.professionalsRepository.findEarnings(
      professional.id,
      validDays,
    );
    return { totalEarnings, days: validDays };
  }

  async getMembershipDiscount(
    sessionToken: string,
  ): Promise<{
    active: boolean;
    discountPct: number;
    expiresAt: string | null;
  }> {
    await this.getSessionByToken(sessionToken);

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

  async getById(id: string): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    return professional;
  }

  async getByIdWithReputation(id: string): Promise<{
    professional: Professional;
    reputation: {
      complianceScore: number;
      completedRequests: number;
      rejectedRequests: number;
      notFulfilledRequests: number;
      totalRequests: number;
      wouldRecommendPct: number;
      averageRating: number;
      averagePunctuality: number;
      averageQuality: number;
      averageCommunication: number;
      averagePriceFairness: number;
      totalRated: number;
    };
  }> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    const panelData = await this.professionalsRepository.findPanelData(id);

    const statusCounts: Record<string, number> = {};
    for (const group of panelData.requestStats) {
      statusCounts[group.status] = group._count.id;
    }

    const completed = statusCounts['COMPLETED'] || 0;
    const rejected = statusCounts['REJECTED'] || 0;
    const notFulfilled = statusCounts['NOT_FULFILLED'] || 0;
    const accepted = statusCounts['ACCEPTED'] || 0;
    const total = completed + rejected + notFulfilled + accepted;
    const decidedTotal = completed + notFulfilled;
    const complianceScore = decidedTotal > 0 ? Math.round((completed / decidedTotal) * 100) : 0;

    const reputationBreakdown = await this.reputationService.getReputationBreakdown(id);

    return {
      professional,
      reputation: {
        complianceScore,
        completedRequests: completed,
        rejectedRequests: rejected,
        notFulfilledRequests: notFulfilled,
        totalRequests: total,
        wouldRecommendPct: reputationBreakdown.wouldRecommendPct,
        averageRating: reputationBreakdown.averageRating,
        averagePunctuality: reputationBreakdown.averagePunctuality,
        averageQuality: reputationBreakdown.averageQuality,
        averageCommunication: reputationBreakdown.averageCommunication,
        averagePriceFairness: reputationBreakdown.averagePriceFairness,
        totalRated: reputationBreakdown.totalRated,
      },
    };
  }

  async list(
    page: number = 1,
    limit: number = 20,
    status?: string,
    categoryId?: string,
    departmentId?: string,
  ): Promise<PaginatedProfessionalsResponse> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    const filters: ProfessionalFilters = {};

    if (status) {
      const validStatuses: ProfessionalStatus[] = [
        'PENDING',
        'UNDER_REVIEW',
        'ACTIVE',
        'OBSERVATION',
        'SUSPENDED',
        'PAUSED',
        'REJECTED',
      ];

      if (!validStatuses.includes(status as ProfessionalStatus)) {
        throw new AppError(`Invalid status filter: ${status}`, 400);
      }

      filters.status = status as ProfessionalStatus;
    }

    if (categoryId) {
      filters.categoryId = categoryId;
    }

    if (departmentId) {
      filters.departmentId = departmentId;
    }

    const { professionals, total } = await this.professionalsRepository.findAll(
      skip,
      validLimit,
      filters,
    );

    return {
      data: professionals,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  async getActiveCandidates(
    categoryId: string,
    geoNodeId: string,
  ): Promise<Professional[]> {
    if (!categoryId) {
      throw new AppError('Category is required', 400);
    }

    if (!geoNodeId) {
      throw new AppError('Geo node is required', 400);
    }

    const candidates = await this.professionalsRepository.findActiveCandidates(
      categoryId,
      geoNodeId,
    );

    return candidates.filter(canReceiveRequests);
  }

  async updateLicenseStatus(
    id: string,
    status: LicenseStatus,
  ): Promise<Professional> {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new AppError(
        'License status must be APPROVED or REJECTED',
        400,
      );
    }

    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    const updated = await this.professionalsRepository.updateLicenseStatus(id, status);

    if (status === 'REJECTED') {
      try {
        const licenseLabel = professional.category?.licenseLabel ?? 'credencial habilitante';
        const verificationToken = await this.generateNewVerificationToken(id);
        const verificationUrl = `${APP_URL}/verify/${verificationToken}?mode=license`;

        const textMessage =
          `Hola ${professional.name}, revisamos tu ${licenseLabel} y no pudimos verificarla.\n\n` +
          `Puede deberse a que la imagen no es legible, el documento está vencido o no corresponde al tipo solicitado.\n\n` +
          `Para subir una nueva, ingresá acá:\n\n${verificationUrl}`;

        await this.sendWithWindowCheck(
          professional.phone,
          'PROFESSIONAL',
          textMessage,
          LICENSE_REJECTED_TEMPLATE,
          [professional.name, licenseLabel, verificationUrl],
        );
      } catch (err) {
        console.error(
          '[ProfessionalsService] Failed to notify professional about rejected license:',
          err,
        );
      }
    }

    return updated;
  }

  private async generateNewVerificationToken(professionalId: string): Promise<string> {
    const verificationToken = randomUUID();
    const verificationTokenExp = new Date(
      Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );

    await this.professionalsRepository.update(professionalId, {
      verificationToken,
      verificationTokenExp,
      verificationTokenUsed: false,
      licenseStatus: 'PENDING',
    });

    return verificationToken;
  }

  private async sendWithWindowCheck(
    phone: string,
    role: WhatsAppRole,
    text: string,
    templateName: string,
    templateParams: string[],
  ): Promise<void> {
    const needsTemplate = await shouldUseTemplate(phone, role, this.botRepository);

    if (needsTemplate) {
      await this.whatsappAdapter.sendTemplateWithButton(
        phone,
        templateName,
        templateParams,
        templateParams[2],
        role,
      );
    } else {
      await this.whatsappAdapter.sendText(phone, text, role);
    }
  }

  async submitLicenseResubmission(
    token: string,
    licenseUrl: string,
  ): Promise<void> {
    const professional = await this.professionalsRepository.findByVerificationToken(token);

    if (!professional) {
      throw new AppError('Verification token not found', 404);
    }

    if (professional.verificationTokenUsed) {
      throw new AppError('Verification token has already been used', 400);
    }

    if (new Date() > professional.verificationTokenExp) {
      throw new AppError('Verification token has expired', 400);
    }

    await this.professionalsRepository.update(professional.id, {
      licenseUrl,
      licenseStatus: 'PENDING',
      verificationTokenUsed: true,
    });

    // eslint-disable-next-line no-console
    console.log(
      `[ProfessionalsService] License resubmitted for professional ${professional.id}`,
    );
  }

  async adminCreate(data: {
    phone: string;
    name: string;
    categoryId: string;
    zoneIds: string[];
    availability?: string;
    availabilityStructured?: { slots: { day: number; from: string; to: string }[] };
  }): Promise<Professional> {
    const trimmedPhone = data.phone.trim();
    const trimmedName = data.name.trim();

    if (!trimmedPhone) throw new AppError('Phone is required', 400);
    if (!trimmedName) throw new AppError('Name is required', 400);
    if (!data.categoryId) throw new AppError('Category is required', 400);
    if (!data.zoneIds?.length) throw new AppError('At least one zone is required', 400);

    const existing = await this.professionalsRepository.findByPhone(trimmedPhone);
    if (existing) throw new AppError('A professional with this phone already exists', 409);

    const verificationToken = randomUUID();
    const verificationTokenExp = new Date(
      Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );

    const professional = await this.professionalsRepository.create({
      phone: trimmedPhone,
      name: trimmedName,
      categoryId: data.categoryId,
      verificationToken,
      verificationTokenExp,
    });

    await this.professionalsRepository.update(professional.id, {
      status: 'ACTIVE',
      ...(data.availability && { availability: data.availability }),
      ...(data.availabilityStructured && {
        availabilityStructured: data.availabilityStructured as Prisma.InputJsonValue,
      }),
    });

    for (const zoneId of data.zoneIds) {
      await this.professionalsRepository.addZone(professional.id, zoneId);
    }

    const updated = await this.professionalsRepository.findById(professional.id);
    return updated!;
  }

  async adminUpdate(id: string, data: {
    name?: string;
    categoryId?: string;
    zoneIds?: string[];
    availability?: string;
    availabilityStructured?: unknown;
    dniNumber?: string;
    cuil?: string;
    dniFrontUrl?: string;
    dniBackUrl?: string;
    criminalRecordUrl?: string;
    licenseUrl?: string;
    licenseStatus?: LicenseStatus;
    declaredHasLicense?: boolean;
    references?: string;
    presentationVideoUrl?: string;
    triggeredByProfessional?: boolean;
  }): Promise<Professional> {
    const { zoneIds, availabilityStructured, triggeredByProfessional, ...rest } = data;

    const SENSITIVE_FIELDS = ['name', 'dniNumber', 'cuil', 'dniFrontUrl', 'dniBackUrl', 'criminalRecordUrl', 'licenseUrl'];

    const currentProfessional = triggeredByProfessional
      ? await this.professionalsRepository.findById(id)
      : null;

    await this.professionalsRepository.update(id, {
      ...rest,
      ...(availabilityStructured !== undefined && {
        availabilityStructured: availabilityStructured as Prisma.InputJsonValue,
      }),
    });

    if (zoneIds !== undefined) {
      await this.professionalsRepository.deleteAllZones(id);
      for (const zoneId of zoneIds) {
        await this.professionalsRepository.addZone(id, zoneId);
      }
    }

    if (triggeredByProfessional && currentProfessional) {
      const changedSensitiveFields: string[] = [];
      const previousValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};

      for (const field of SENSITIVE_FIELDS) {
        const newValue = data[field as keyof typeof data];
        if (newValue === undefined) continue;
        const currentValue = currentProfessional[field as keyof typeof currentProfessional];
        if (newValue !== currentValue) {
          changedSensitiveFields.push(field);
          previousValues[field] = currentValue ?? null;
          newValues[field] = newValue;
        }
      }

      if (changedSensitiveFields.length > 0) {
        await this.professionalsRepository.createDataChangeRequest(
          id,
          changedSensitiveFields,
          previousValues,
          newValues,
        );
      }
    }

    const updated = await this.professionalsRepository.findById(id);
    if (!updated) throw new AppError('Professional not found', 404);
    return updated;
  }

  async getCurrentPlan(professionalId: string): Promise<{ planId: string; planName: string } | null> {
    const membership = await this.membershipsService.getActiveMembership(professionalId) as {
      planId: string;
      plan: { name: string };
    } | null;
    if (!membership || !membership.plan) return null;
    return {
      planId: membership.planId,
      planName: membership.plan.name,
    };
  }
}
