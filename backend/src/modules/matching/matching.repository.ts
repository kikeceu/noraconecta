import prisma from '../../lib/prisma';
import { Professional, Membership, Request } from '@prisma/client';

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

  async getProfessionalCoordinates(
    professionalIds: string[],
  ): Promise<Map<string, { latitude: number | null; longitude: number | null }>> {
    const professionals = await prisma.professional.findMany({
      where: { id: { in: professionalIds } },
      select: { id: true, latitude: true, longitude: true },
    });

    const map = new Map<string, { latitude: number | null; longitude: number | null }>();
    for (const professional of professionals) {
      map.set(professional.id, {
        latitude: professional.latitude,
        longitude: professional.longitude,
      });
    }
    return map;
  }

  async getAverageRatings(
    professionalIds: string[],
  ): Promise<Map<string, number | null>> {
    const feedbacks = await prisma.feedback.findMany({
      where: {
        request: { assignedProfessionalId: { in: professionalIds } },
        ratedByUserAt: { not: null },
        punctualityRating: { not: null },
      },
      select: {
        punctualityRating: true,
        qualityRating: true,
        communicationRating: true,
        priceFairnessRating: true,
        request: { select: { assignedProfessionalId: true } },
      },
    });

    const accumulator = new Map<string, { sum: number; count: number }>();
    for (const f of feedbacks) {
      const profId = f.request.assignedProfessionalId;
      if (!profId) continue;
      const avg =
        ((f.punctualityRating ?? 0) +
          (f.qualityRating ?? 0) +
          (f.communicationRating ?? 0) +
          (f.priceFairnessRating ?? 0)) /
        4;
      const entry = accumulator.get(profId) ?? { sum: 0, count: 0 };
      entry.sum += avg;
      entry.count++;
      accumulator.set(profId, entry);
    }

    const result = new Map<string, number | null>();
    for (const profId of professionalIds) {
      const entry = accumulator.get(profId);
      result.set(profId, entry ? entry.sum / entry.count : null);
    }
    return result;
  }

  async getRecentAverageRatings(
    professionalIds: string[],
  ): Promise<Map<string, number | null>> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const feedbacks = await prisma.feedback.findMany({
      where: {
        request: { assignedProfessionalId: { in: professionalIds } },
        ratedByUserAt: { gte: thirtyDaysAgo },
        punctualityRating: { not: null },
      },
      select: {
        punctualityRating: true,
        qualityRating: true,
        communicationRating: true,
        priceFairnessRating: true,
        request: { select: { assignedProfessionalId: true } },
      },
    });

    const accumulator = new Map<string, { sum: number; count: number }>();
    for (const f of feedbacks) {
      const profId = f.request.assignedProfessionalId;
      if (!profId) continue;
      const avg =
        ((f.punctualityRating ?? 0) +
          (f.qualityRating ?? 0) +
          (f.communicationRating ?? 0) +
          (f.priceFairnessRating ?? 0)) /
        4;
      const entry = accumulator.get(profId) ?? { sum: 0, count: 0 };
      entry.sum += avg;
      entry.count++;
      accumulator.set(profId, entry);
    }

    const result = new Map<string, number | null>();
    for (const profId of professionalIds) {
      const entry = accumulator.get(profId);
      result.set(profId, entry ? entry.sum / entry.count : null);
    }
    return result;
  }

  async countRejectedEvents(
    professionalIds: string[],
  ): Promise<Map<string, number>> {
    const results = await prisma.requestEvent.groupBy({
      by: ['professionalId'],
      where: {
        professionalId: { in: professionalIds },
        type: 'REJECTED',
      },
      _count: { id: true },
    });

    const map = new Map<string, number>();
    for (const r of results) {
      if (r.professionalId) map.set(r.professionalId, r._count.id);
    }
    return map;
  }

  async getBadgeStatus(
    professionalIds: string[],
  ): Promise<Map<string, boolean>> {
    const professionals = await prisma.professional.findMany({
      where: { id: { in: professionalIds } },
      select: { id: true, hasBadge: true },
    });

    const map = new Map<string, boolean>();
    for (const p of professionals) map.set(p.id, p.hasBadge);
    return map;
  }

  async findRequestsForReminder(
    nowMinus60: Date,
    nowMinus90: Date,
  ): Promise<(Request & { assignedProfessional: { phone: string; name: string } | null; category: { name: string } | null; geoNode: { name: string } | null })[]> {
    return prisma.request.findMany({
      where: {
        status: 'ASSIGNED',
        updatedAt: { lt: nowMinus60, gt: nowMinus90 },
      },
      include: {
        assignedProfessional: { select: { phone: true, name: true } },
        category: { select: { name: true } },
        geoNode: { select: { name: true } },
      },
    });
  }

  async findRequestsForReassignment(nowMinus90: Date): Promise<Request[]> {
    return prisma.request.findMany({
      where: {
        status: 'ASSIGNED',
        updatedAt: { lt: nowMinus90 },
      },
    });
  }

  async findTrialExhaustedProfessionals(
    categoryId: string,
    geoNodeId: string,
    trialRequestsLimit: number,
  ): Promise<{ id: string; name: string; phone: string }[]> {
    return prisma.professional.findMany({
      where: {
        status: { in: ['ACTIVE', 'OBSERVATION'] },
        categoryId,
        zones: { some: { geoNodeId } },
        trialRequestsUsed: { gte: trialRequestsLimit },
        memberships: {
          none: {
            status: 'ACTIVE',
            endDate: { gt: new Date() },
          },
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });
  }

  async getAcceptanceRates(
    professionalIds: string[],
  ): Promise<Map<string, number>> {
    const assigned = await prisma.requestEvent.groupBy({
      by: ['professionalId'],
      where: {
        professionalId: { in: professionalIds },
        type: 'ASSIGNED',
      },
      _count: { id: true },
    });

    const accepted = await prisma.requestEvent.groupBy({
      by: ['professionalId'],
      where: {
        professionalId: { in: professionalIds },
        type: 'ACCEPTED',
      },
      _count: { id: true },
    });

    const assignedMap = new Map(assigned.map(r => [r.professionalId!, r._count.id]));
    const acceptedMap = new Map(accepted.map(r => [r.professionalId!, r._count.id]));

    const result = new Map<string, number>();
    for (const profId of professionalIds) {
      const total = assignedMap.get(profId) ?? 0;
      const acc = acceptedMap.get(profId) ?? 0;
      result.set(profId, total > 0 ? acc / total : 0.5);
    }
    return result;
  }

  async getCompletionRates(
    professionalIds: string[],
  ): Promise<Map<string, number>> {
    const accepted = await prisma.requestEvent.groupBy({
      by: ['professionalId'],
      where: { professionalId: { in: professionalIds }, type: 'ACCEPTED' },
      _count: { id: true },
    });

    const completed = await prisma.requestEvent.groupBy({
      by: ['professionalId'],
      where: { professionalId: { in: professionalIds }, type: 'COMPLETED' },
      _count: { id: true },
    });

    const acceptedMap = new Map(accepted.map(r => [r.professionalId!, r._count.id]));
    const completedMap = new Map(completed.map(r => [r.professionalId!, r._count.id]));

    const result = new Map<string, number>();
    for (const profId of professionalIds) {
      const total = acceptedMap.get(profId) ?? 0;
      const comp = completedMap.get(profId) ?? 0;
      result.set(profId, total > 0 ? comp / total : 0.5);
    }
    return result;
  }

  async getSentimentScores(
    professionalIds: string[],
  ): Promise<Map<string, number>> {
    const feedbacks = await prisma.feedback.findMany({
      where: {
        request: { assignedProfessionalId: { in: professionalIds } },
        sentimentAnalysis: { not: undefined },
      },
      select: {
        sentimentAnalysis: true,
        request: { select: { assignedProfessionalId: true } },
      },
    });

    const accumulator = new Map<string, { sum: number; count: number }>();

    for (const f of feedbacks) {
      const profId = f.request.assignedProfessionalId;
      if (!profId || !f.sentimentAnalysis) continue;

      const analysis = f.sentimentAnalysis as Record<string, number | boolean>;
      const score =
        (Number(analysis.puntualidad) || 0) +
        (Number(analysis.precio_justo) || 0) +
        (Number(analysis.calidad_trabajo) || 0) +
        (Number(analysis.limpieza) || 0) +
        (Number(analysis.actitud) || 0) +
        (analysis.recomendable === true ? 1 : analysis.recomendable === false ? -1 : 0);

      const entry = accumulator.get(profId) ?? { sum: 0, count: 0 };
      entry.sum += score;
      entry.count++;
      accumulator.set(profId, entry);
    }

    const result = new Map<string, number>();
    for (const profId of professionalIds) {
      const entry = accumulator.get(profId);
      if (!entry || entry.count === 0) {
        result.set(profId, 50);
      } else {
        const normalized = ((entry.sum / entry.count) + 6) / 12 * 100;
        result.set(profId, Math.min(100, Math.max(0, normalized)));
      }
    }
    return result;
  }

  async getAvgResponseTimes(
    professionalIds: string[],
  ): Promise<Map<string, number>> {
    const assignedEvents = await prisma.requestEvent.findMany({
      where: {
        professionalId: { in: professionalIds },
        type: 'ASSIGNED',
      },
      select: { professionalId: true, requestId: true, createdAt: true },
    });

    const acceptedEvents = await prisma.requestEvent.findMany({
      where: {
        professionalId: { in: professionalIds },
        type: 'ACCEPTED',
      },
      select: { professionalId: true, requestId: true, createdAt: true },
    });

    const assignedByRequest = new Map(assignedEvents.map(e => [e.requestId, e]));
    const accumulator = new Map<string, { sum: number; count: number }>();

    for (const accepted of acceptedEvents) {
      const assigned = assignedByRequest.get(accepted.requestId);
      if (!assigned || !accepted.professionalId) continue;

      const diffMinutes = (accepted.createdAt.getTime() - assigned.createdAt.getTime()) / 60000;
      const entry = accumulator.get(accepted.professionalId) ?? { sum: 0, count: 0 };
      entry.sum += diffMinutes;
      entry.count++;
      accumulator.set(accepted.professionalId, entry);
    }

    const result = new Map<string, number>();
    for (const profId of professionalIds) {
      const entry = accumulator.get(profId);
      result.set(profId, entry ? entry.sum / entry.count : 60);
    }
    return result;
  }
}
