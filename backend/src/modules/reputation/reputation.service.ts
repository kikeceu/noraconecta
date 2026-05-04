import { ReputationRepository } from './reputation.repository';
import { ConfigRepository } from '../config/config.repository';
import { Prisma } from '@prisma/client';

const DEFAULT_BADGE_MIN_COMPLETED = 10;

const configRepository = new ConfigRepository();

function logAlert(type: string, professionalId: string): void {
  // eslint-disable-next-line no-console
  console.log(
    `[ALERT] ${type}: professional=${professionalId}`,
  );
}

export class ReputationService {
  constructor(private readonly reputationRepository: ReputationRepository) {}

  async applyPenalization(
    professionalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const count =
      await this.reputationRepository.countNotFulfilledEvents(
        professionalId,
        tx,
      );

    if (count === 1) {
      await this.reputationRepository.updateStatus(
        professionalId,
        'OBSERVATION',
        tx,
      );
    } else if (count >= 2) {
      await this.reputationRepository.updateStatus(
        professionalId,
        'SUSPENDED',
        tx,
      );
      logAlert('PROFESSIONAL_AUTO_SUSPENDED', professionalId);
    }
  }

  async removeBadgeIfActive(
    professionalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.reputationRepository.removeBadge(professionalId, tx);
  }

  async evaluateBadge(professionalId: string): Promise<void> {
    const notFulfilledCount =
      await this.reputationRepository.countNotFulfilledEvents(professionalId);

    if (notFulfilledCount > 0) {
      return;
    }

    const completedCount =
      await this.reputationRepository.countCompletedRequests(professionalId);

    const minCompleted = await this.getBadgeMinCompleted();

    if (completedCount >= minCompleted) {
      await this.reputationRepository.awardBadge(professionalId);
    }
  }

  async getReputationBreakdown(professionalId: string): Promise<{
    averageRating: number;
    averagePunctuality: number;
    averageQuality: number;
    averageCommunication: number;
    averagePriceFairness: number;
    wouldRecommendPct: number;
    totalRated: number;
  }> {
    return this.reputationRepository.findFeedbackBreakdown(professionalId);
  }

  private async getBadgeMinCompleted(): Promise<number> {
    const config = await configRepository.findByKey(
      'BADGE_MIN_COMPLETED_REQUESTS',
    );

    if (config) {
      const parsed = parseInt(config.value, 10);

      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return DEFAULT_BADGE_MIN_COMPLETED;
  }
}
