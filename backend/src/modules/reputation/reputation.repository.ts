import prisma from '../../lib/prisma';
import { ProfessionalStatus, Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient | typeof prisma;

export class ReputationRepository {
  async countNotFulfilledEvents(
    professionalId: string,
    tx?: Tx,
  ): Promise<number> {
    const client = tx ?? prisma;

    return client.requestEvent.count({
      where: { professionalId, type: 'NOT_FULFILLED' },
    });
  }

  async countCompletedRequests(
    professionalId: string,
    tx?: Tx,
  ): Promise<number> {
    const client = tx ?? prisma;

    return client.request.count({
      where: {
        assignedProfessionalId: professionalId,
        status: 'COMPLETED',
      },
    });
  }

  async updateStatus(
    professionalId: string,
    status: ProfessionalStatus,
    tx?: Tx,
  ): Promise<void> {
    const client = tx ?? prisma;

    await client.professional.update({
      where: { id: professionalId },
      data: { status },
    });
  }

  async removeBadge(professionalId: string, tx?: Tx): Promise<void> {
    const client = tx ?? prisma;

    await client.professional.update({
      where: { id: professionalId },
      data: { hasBadge: false },
    });
  }

  async awardBadge(professionalId: string, tx?: Tx): Promise<void> {
    const client = tx ?? prisma;

    await client.professional.update({
      where: { id: professionalId },
      data: { hasBadge: true },
    });
  }
}
