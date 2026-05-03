import prisma from '../../lib/prisma';
import { Request, RequestEvent, Feedback, Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient | typeof prisma;

export type CreateRequestInput = {
  userId: string;
  categoryId: string;
  geoNodeId: string;
  description: string;
  photoUrls: string[];
  audioUrl?: string;
  status: 'CREATED' | 'ASSIGNED' | 'NO_RESPONSE';
  assignedProfessionalId?: string;
  assignedAt?: Date;
  assignmentTimeoutAt?: Date;
};

export type CreateEventInput = {
  requestId: string;
  professionalId?: string | null;
  type: 'ASSIGNED' | 'ACCEPTED' | 'REJECTED' | 'NO_RESPONSE' | 'COMPLETED' | 'NOT_FULFILLED' | 'CANCELLED';
  metadata?: Prisma.JsonObject;
};

export class RequestsRepository {
  async create(data: CreateRequestInput): Promise<Request> {
    return prisma.request.create({ data });
  }

  async findById(id: string): Promise<Request | null> {
    return prisma.request.findUnique({
      where: { id },
      include: { events: true, feedback: true },
    });
  }

  async findActiveByUserId(userId: string): Promise<Request | null> {
    return prisma.request.findFirst({
      where: {
        userId,
        status: { in: ['CREATED', 'ASSIGNED', 'ACCEPTED'] },
      },
    });
  }

  async findAll(skip: number, take: number): Promise<{ requests: Request[]; total: number }> {
    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          events: true,
          feedback: true,
          user: true,
          category: true,
          assignedProfessional: true,
        },
      }),
      prisma.request.count(),
    ]);

    return { requests, total };
  }

  async update(id: string, data: Prisma.RequestUncheckedUpdateInput, tx?: Tx): Promise<Request> {
    const client = tx ?? prisma;
    return client.request.update({ where: { id }, data });
  }

  async createEvent(data: CreateEventInput, tx?: Tx): Promise<RequestEvent> {
    const client = tx ?? prisma;
    return client.requestEvent.create({ data });
  }

  async findRejectorIds(requestId: string): Promise<string[]> {
    const events = await prisma.requestEvent.findMany({
      where: {
        requestId,
        type: 'REJECTED',
        professionalId: { not: null },
      },
      select: { professionalId: true },
      orderBy: { createdAt: 'asc' },
    });

    return events
      .map((e) => e.professionalId)
      .filter((id): id is string => id !== null);
  }

  async createFeedback(data: {
    requestId: string;
    workCompleted: boolean;
    wouldRecommend: boolean;
    comment?: string;
  }): Promise<Feedback> {
    return prisma.feedback.create({ data });
  }

  async findFeedbackByRequestId(requestId: string): Promise<Feedback | null> {
    return prisma.feedback.findUnique({ where: { requestId } });
  }

  async professionalHasActiveMembership(professionalId: string): Promise<boolean> {
    const membership = await prisma.membership.findFirst({
      where: {
        professionalId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!membership) {
      return false;
    }

    return membership.endDate > new Date();
  }

  async incrementTrialRequestsUsed(professionalId: string): Promise<void> {
    await prisma.professional.update({
      where: { id: professionalId },
      data: { trialRequestsUsed: { increment: 1 } },
    });
  }

  async updateLastAssignedAt(professionalId: string, date: Date): Promise<void> {
    await prisma.professional.update({
      where: { id: professionalId },
      data: { lastAssignedAt: date },
    });
  }

  async findExpiredAssignments(now: Date): Promise<Request[]> {
    return prisma.request.findMany({
      where: {
        status: 'ASSIGNED',
        assignmentTimeoutAt: { lt: now },
      },
    });
  }

  async findPendingAutoComplete(cutoff: Date): Promise<Request[]> {
    return prisma.request.findMany({
      where: {
        status: 'ACCEPTED',
        completedAt: { not: null, lt: cutoff },
      },
    });
  }
}
