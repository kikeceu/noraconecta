import prisma from '../../lib/prisma';
import { Escalation, EscalationStatus, Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient | typeof prisma;

export interface EscalationFilters {
  status?: EscalationStatus;
  professionalId?: string;
}

export interface EscalationsResult {
  escalations: Escalation[];
  total: number;
}

export class EscalationsRepository {
  async create(
    data: {
      requestId: string;
      reportedBy: string;
      professionalId: string;
    },
    tx?: Tx,
  ): Promise<Escalation> {
    const client = tx ?? prisma;

    return client.escalation.create({ data });
  }

  async findById(id: string): Promise<Escalation | null> {
    return prisma.escalation.findUnique({
      where: { id },
      include: {
        request: { include: { events: true, feedback: true } },
        user: true,
      },
    });
  }

  async findByRequestId(requestId: string): Promise<Escalation | null> {
    return prisma.escalation.findUnique({ where: { requestId } });
  }

  async findAll(
    skip: number,
    take: number,
    filters?: EscalationFilters,
  ): Promise<EscalationsResult> {
    const where: Record<string, unknown> = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.professionalId) {
      where.professionalId = filters.professionalId;
    }

    const [escalations, total] = await Promise.all([
      prisma.escalation.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          request: true,
          user: true,
          professional: { select: { name: true } },
        },
      }),
      prisma.escalation.count({ where }),
    ]);

    return { escalations, total };
  }

  async updateStatus(
    id: string,
    status: EscalationStatus,
  ): Promise<Escalation> {
    return prisma.escalation.update({
      where: { id },
      data: { status },
    });
  }

  async resolve(
    id: string,
    resolution: string,
    resolvedBy?: string,
  ): Promise<Escalation> {
    return prisma.escalation.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedBy,
      },
    });
  }
}
