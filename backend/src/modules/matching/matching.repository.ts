import prisma from '../../lib/prisma';
import { Professional, Membership } from '@prisma/client';

export interface NotFulfilledEvent {
  professionalId: string;
  createdAt: Date;
}

export interface FeedbackStats {
  total: number;
  wouldRecommend: number;
}

export class MatchingRepository {
  async findEligibleProfessionals(
    categoryId: string,
    geoNodeId: string,
    excludedProfessionalIds: string[],
  ): Promise<Professional[]> {
    const where: Record<string, unknown> = {
      status: { in: ['ACTIVE', 'OBSERVATION'] },
      categoryId,
      zones: { some: { geoNodeId } },
    };

    if (excludedProfessionalIds.length > 0) {
      where.id = { notIn: excludedProfessionalIds };
    }

    return prisma.professional.findMany({ where });
  }

  async findProfessionalById(id: string): Promise<Professional | null> {
    return prisma.professional.findUnique({ where: { id } });
  }

  async countActiveRequests(
    professionalIds: string[],
  ): Promise<Map<string, number>> {
    const results = await prisma.request.groupBy({
      by: ['assignedProfessionalId'],
      where: {
        assignedProfessionalId: { in: professionalIds },
        status: { in: ['ASSIGNED', 'ACCEPTED'] },
      },
      _count: { id: true },
    });

    const map = new Map<string, number>();
    for (const r of results) {
      if (r.assignedProfessionalId) {
        map.set(r.assignedProfessionalId, r._count.id);
      }
    }
    return map;
  }

  async findNotFulfilledEvents(
    professionalIds: string[],
  ): Promise<NotFulfilledEvent[]> {
    const events = await prisma.requestEvent.findMany({
      where: {
        professionalId: { in: professionalIds },
        type: 'NOT_FULFILLED',
      },
      select: {
        professionalId: true,
        createdAt: true,
      },
    });

    return events
      .filter((e): e is { professionalId: string; createdAt: Date } => e.professionalId !== null)
      .map((e) => ({ professionalId: e.professionalId, createdAt: e.createdAt }));
  }

  async countNoResponseEvents(
    professionalIds: string[],
  ): Promise<Map<string, number>> {
    const results = await prisma.requestEvent.groupBy({
      by: ['professionalId'],
      where: {
        professionalId: { in: professionalIds },
        type: 'NO_RESPONSE',
      },
      _count: { id: true },
    });

    const map = new Map<string, number>();
    for (const r of results) {
      if (r.professionalId) {
        map.set(r.professionalId, r._count.id);
      }
    }
    return map;
  }

  async getFeedbackStats(
    professionalIds: string[],
  ): Promise<Map<string, FeedbackStats>> {
    const feedbacks = await prisma.feedback.findMany({
      where: {
        request: {
          assignedProfessionalId: { in: professionalIds },
        },
      },
      select: {
        wouldRecommend: true,
        request: {
          select: { assignedProfessionalId: true },
        },
      },
    });

    const map = new Map<string, FeedbackStats>();
    for (const f of feedbacks) {
      const profId = f.request.assignedProfessionalId;
      if (!profId) continue;

      const stats = map.get(profId) || { total: 0, wouldRecommend: 0 };
      stats.total++;
      if (f.wouldRecommend) stats.wouldRecommend++;
      map.set(profId, stats);
    }
    return map;
  }

  async getLastAssignedDates(
    professionalIds: string[],
  ): Promise<Map<string, Date | null>> {
    const professionals = await prisma.professional.findMany({
      where: { id: { in: professionalIds } },
      select: { id: true, lastAssignedAt: true },
    });

    const map = new Map<string, Date | null>();
    for (const p of professionals) {
      map.set(p.id, p.lastAssignedAt);
    }
    return map;
  }

  async getActiveMemberships(
    professionalIds: string[],
  ): Promise<Map<string, Membership | null>> {
    const memberships = await prisma.membership.findMany({
      where: {
        professionalId: { in: professionalIds },
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    const map = new Map<string, Membership | null>();
    for (const m of memberships) {
      if (!map.has(m.professionalId)) {
        map.set(m.professionalId, m);
      }
    }
    return map;
  }

  async getPlanPriorities(
    professionalIds: string[],
  ): Promise<Map<string, number>> {
    const memberships = await prisma.membership.findMany({
      where: {
        professionalId: { in: professionalIds },
        status: 'ACTIVE',
        endDate: { gt: new Date() },
      },
      select: {
        professionalId: true,
        plan: {
          select: { priority: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const map = new Map<string, number>();
    for (const m of memberships) {
      if (!map.has(m.professionalId)) {
        map.set(m.professionalId, m.plan.priority);
      }
    }
    return map;
  }

  async getTrialRequestsUsed(
    professionalIds: string[],
  ): Promise<Map<string, number>> {
    const professionals = await prisma.professional.findMany({
      where: { id: { in: professionalIds } },
      select: { id: true, trialRequestsUsed: true },
    });

    const map = new Map<string, number>();
    for (const p of professionals) {
      map.set(p.id, p.trialRequestsUsed);
    }
    return map;
  }
}
