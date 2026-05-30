import prisma from '../../lib/prisma';
import { Professional, ProfessionalStatus, ProfessionalZone, Prisma, Request } from '@prisma/client';

export interface CreateProfessionalInput {
  phone: string;
  name: string;
  categoryId: string;
  verificationToken: string;
  verificationTokenExp: Date;
  latitude?: number;
  longitude?: number;
}

export interface UpdateProfessionalInput {
  name?: string;
  categoryId?: string;
  availability?: string;
  availabilityStructured?: Prisma.InputJsonValue;
  dniNumber?: string;
  dniFrontUrl?: string;
  dniBackUrl?: string;
  cuil?: string;
  criminalRecordUrl?: string;
  references?: string;
  presentationVideoUrl?: string;
  status?: ProfessionalStatus;
  verificationTokenUsed?: boolean;
  hasBadge?: boolean;
  sessionToken?: string | null;
  sessionTokenExp?: Date | null;
  trialRequestsUsed?: number;
  lastAssignedAt?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ProfessionalFilters {
  status?: ProfessionalStatus;
  categoryId?: string;
}

export interface ProfessionalsResult {
  professionals: Professional[];
  total: number;
}

const MAX_TRIAL_REQUESTS = 5;

export class ProfessionalsRepository {
  async create(data: CreateProfessionalInput): Promise<Professional> {
    return prisma.professional.create({ data });
  }

  async findById(id: string): Promise<Professional | null> {
    return prisma.professional.findUnique({
      where: { id },
      include: { zones: { include: { geoNode: true } }, category: true },
    });
  }

  async findByPhone(phone: string): Promise<Professional | null> {
    return prisma.professional.findUnique({ where: { phone } });
  }

  async findByVerificationToken(
    token: string,
  ): Promise<(Professional & { zones: (ProfessionalZone & { geoNode: { id: string; name: string } })[] }) | null> {
    return prisma.professional.findUnique({
      where: { verificationToken: token },
      include: { zones: { include: { geoNode: true } } },
    });
  }

  async findBySessionToken(token: string): Promise<Professional | null> {
    return prisma.professional.findUnique({
      where: { sessionToken: token },
      include: { zones: true, category: true },
    });
  }

  async update(id: string, data: UpdateProfessionalInput): Promise<Professional> {
    return prisma.professional.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: ProfessionalStatus): Promise<Professional> {
    return prisma.professional.update({
      where: { id },
      data: { status },
    });
  }

  async markTokenUsed(id: string): Promise<Professional> {
    return prisma.professional.update({
      where: { id },
      data: { verificationTokenUsed: true },
    });
  }

  async setBadge(id: string, hasBadge: boolean): Promise<Professional> {
    return prisma.professional.update({
      where: { id },
      data: { hasBadge },
    });
  }

  async setSessionToken(
    id: string,
    sessionToken: string,
    sessionTokenExp: Date,
  ): Promise<Professional> {
    return prisma.professional.update({
      where: { id },
      data: { sessionToken, sessionTokenExp },
    });
  }

  async findAll(
    skip: number,
    limit: number,
    filters?: ProfessionalFilters,
  ): Promise<ProfessionalsResult> {
    const where: Record<string, unknown> = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    const [professionals, total] = await Promise.all([
      prisma.professional.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          zones: { include: { geoNode: true } },
        },
      }),
      prisma.professional.count({ where }),
    ]);

    return { professionals, total };
  }

  async findPanelData(professionalId: string) {
    const [professional, membership, requestStats] = await Promise.all([
      prisma.professional.findUnique({
        where: { id: professionalId },
        include: { zones: { include: { geoNode: true } }, category: true },
      }),
      prisma.membership.findFirst({
        where: { professionalId, status: 'ACTIVE' },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.request.groupBy({
        by: ['status'],
        where: { assignedProfessionalId: professionalId },
        _count: { id: true },
      }),
    ]);

    const feedbackStats = await prisma.feedback.aggregate({
      where: {
        request: { assignedProfessionalId: professionalId },
      },
      _count: { id: true },
    });

    const positiveFeedback = await prisma.feedback.count({
      where: {
        request: { assignedProfessionalId: professionalId },
        wouldRecommend: true,
      },
    });

    const totalFeedback = feedbackStats._count.id;
    const wouldRecommendPct = totalFeedback > 0
      ? Math.round((positiveFeedback / totalFeedback) * 100)
      : 0;

    return { professional, membership, requestStats, feedbackStats, wouldRecommendPct };
  }

  async findOrdersByProfessionalId(
    professionalId: string,
    skip: number,
    take: number,
  ) {
    const where = {
      events: {
        some: { professionalId },
      },
    };

    const [orders, total] = await Promise.all([
      prisma.request.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          geoNode: true,
          user: { select: { name: true, phone: true } },
          feedback: {
            select: {
              ratedByProfessionalAt: true,
              ratedByUserAt: true,
              punctualityRating: true,
              qualityRating: true,
              communicationRating: true,
              priceFairnessRating: true,
              userComment: true,
              requestClarityRating: true,
              userAvailabilityRating: true,
              userTreatmentRating: true,
              wouldServeAgain: true,
              professionalComment: true,
            },
          },
          events: {
            where: { professionalId },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.request.count({ where }),
    ]);

    return { orders, total };
  }

  async findActiveCandidates(
    categoryId: string,
    geoNodeId: string,
  ): Promise<Professional[]> {
    return prisma.professional.findMany({
      where: {
        status: 'ACTIVE',
        categoryId,
        zones: { some: { geoNodeId } },
        trialRequestsUsed: { lt: MAX_TRIAL_REQUESTS },
      },
      orderBy: { lastAssignedAt: { sort: 'asc', nulls: 'first' } },
      take: 10,
    });
  }

  async findPendingRequestsByProfessionalId(
    professionalId: string,
  ): Promise<
    (Request & {
      category: { id: string; name: string } | null;
      geoNode: { id: string; name: string } | null;
      user: { name: string } | null;
    })[]
  > {
    return prisma.request.findMany({
      where: {
        assignedProfessionalId: professionalId,
        status: 'ASSIGNED',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        geoNode: true,
        user: { select: { name: true } },
      },
    });
  }

  async findActivityStats(professionalId: string, days: number) {
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - days);

    const [recentEvents, recentFeedback] = await Promise.all([
      prisma.requestEvent.findMany({
        where: {
          professionalId,
          type: { in: ['COMPLETED', 'CANCELLED', 'NOT_FULFILLED'] },
          createdAt: { gte: rangeStart },
        },
        select: { type: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.feedback.findMany({
        where: {
          request: { assignedProfessionalId: professionalId },
          ratedByUserAt: { gte: rangeStart },
        },
        select: {
          punctualityRating: true,
          qualityRating: true,
          communicationRating: true,
          priceFairnessRating: true,
          ratedByUserAt: true,
        },
        orderBy: { ratedByUserAt: 'asc' },
      }),
    ]);

    return { recentEvents, recentFeedback };
  }

  async findZones(professionalId: string): Promise<ProfessionalZone[]> {
    return prisma.professionalZone.findMany({
      where: { professionalId },
      include: { geoNode: true },
    });
  }

  async addZone(professionalId: string, geoNodeId: string): Promise<ProfessionalZone> {
    return prisma.professionalZone.create({
      data: { professionalId, geoNodeId },
    });
  }

  async removeZone(professionalId: string, geoNodeId: string): Promise<Prisma.BatchPayload> {
    return prisma.professionalZone.deleteMany({
      where: { professionalId, geoNodeId },
    });
  }

  async deleteAllZones(professionalId: string): Promise<Prisma.BatchPayload> {
    return prisma.professionalZone.deleteMany({
      where: { professionalId },
    });
  }
}
