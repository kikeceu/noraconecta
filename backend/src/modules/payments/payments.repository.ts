import prisma from '../../lib/prisma';
import { Plan, Professional, Request } from '@prisma/client';

export class PaymentsRepository {
  async findPlanById(id: string): Promise<Plan | null> {
    return prisma.plan.findUnique({ where: { id } });
  }

  async findAllActivePlans(): Promise<Plan[]> {
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });
  }

  async findTrialExhaustedProfessionals(
    categoryId: string,
    geoNodeId: string,
    trialRequestsLimit: number,
  ): Promise<Professional[]> {
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
    });
  }

  async findWaitingRequest(
    categoryId: string,
    geoNodeId: string,
  ): Promise<(Request & { user: { phone: string; name: string } }) | null> {
    return prisma.request.findFirst({
      where: {
        status: 'NO_RESPONSE',
        waitingUserConsent: true,
        categoryId,
        geoNodeId,
        assignedProfessionalId: null,
      },
      include: {
        user: { select: { phone: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findExpiredWaitingActivations(cutoff: Date): Promise<Request[]> {
    return prisma.request.findMany({
      where: {
        status: 'NO_RESPONSE',
        waitingUserConsent: true,
        waitingActivationSince: { lt: cutoff },
      },
      include: {
        user: { select: { phone: true, name: true } },
      },
    });
  }
}
