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

  async findFeedbackBreakdown(professionalId: string): Promise<{
    averageRating: number;
    averagePunctuality: number;
    averageQuality: number;
    averageCommunication: number;
    averagePriceFairness: number;
    wouldRecommendPct: number;
    totalRated: number;
  }> {
    const feedbacks = await prisma.feedback.findMany({
      where: {
        request: { assignedProfessionalId: professionalId },
        ratedByUserAt: { not: null },
      },
      select: {
        rating: true,
        punctualityRating: true,
        qualityRating: true,
        communicationRating: true,
        priceFairnessRating: true,
        wouldRecommend: true,
      },
    });

    if (feedbacks.length === 0) {
      return {
        averageRating: 0,
        averagePunctuality: 0,
        averageQuality: 0,
        averageCommunication: 0,
        averagePriceFairness: 0,
        wouldRecommendPct: 0,
        totalRated: 0,
      };
    }

    const avg = (values: (number | null)[]): number => {
      const numeric = values.filter(
        (v): v is number => v !== null,
      );
      if (numeric.length === 0) return 0;
      return Math.round(
        (numeric.reduce((sum, v) => sum + v, 0) / numeric.length) * 10,
      ) / 10;
    };

    const recommendCount = feedbacks.filter((f) => f.wouldRecommend === true).length;

    return {
      averageRating: avg(feedbacks.map((f) => f.rating)),
      averagePunctuality: avg(feedbacks.map((f) => f.punctualityRating)),
      averageQuality: avg(feedbacks.map((f) => f.qualityRating)),
      averageCommunication: avg(feedbacks.map((f) => f.communicationRating)),
      averagePriceFairness: avg(feedbacks.map((f) => f.priceFairnessRating)),
      wouldRecommendPct: Math.round((recommendCount / feedbacks.length) * 100),
      totalRated: feedbacks.length,
    };
  }
}
