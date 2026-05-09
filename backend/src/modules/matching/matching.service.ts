import { MatchingRepository } from './matching.repository';
import { ConfigRepository } from '../config/config.repository';
import { Membership } from '@prisma/client';

export interface MatchResult {
  professionalId: string;
  score: number;
}

interface ScoringConfig {
  weightCompliance: number;
  weightResponseRate: number;
  weightRecommendation: number;
  weightDistribution: number;
  weightQualityRating: number;
  weightPlan: number;
  compliancePenalty: number;
  responsePenalty: number;
  reputationDecayDays: number;
  maxActiveRequests: number;
  distributionDailyBonus: number;
  trialRequestsLimit: number;
  badgeBonus: number;
  rejectionPenalty: number;
  tendencyWeight: number;
}

const DEFAULT_WEIGHT_COMPLIANCE = 0.35;
const DEFAULT_WEIGHT_RESPONSE_RATE = 0.25;
const DEFAULT_WEIGHT_RECOMMENDATION = 0.10;
const DEFAULT_WEIGHT_DISTRIBUTION = 0.05;
const DEFAULT_WEIGHT_QUALITY_RATING = 0.20;
const DEFAULT_WEIGHT_PLAN = 0.05;
const DEFAULT_COMPLIANCE_PENALTY = 50;
const DEFAULT_RESPONSE_PENALTY = 25;
const DEFAULT_REPUTATION_DECAY_DAYS = 90;
const DEFAULT_MAX_ACTIVE_REQUESTS = 2;
const DEFAULT_DISTRIBUTION_DAILY_BONUS = 10;
const DEFAULT_TRIAL_REQUESTS_LIMIT = 3;
const DEFAULT_BADGE_BONUS = 5;
const DEFAULT_REJECTION_PENALTY = 10;
const DEFAULT_TENDENCY_WEIGHT = 0.15;

const CONFIG_KEYS = {
  WEIGHT_COMPLIANCE: 'MATCHING_WEIGHT_COMPLIANCE',
  WEIGHT_RESPONSE_RATE: 'MATCHING_WEIGHT_RESPONSE_RATE',
  WEIGHT_RECOMMENDATION: 'MATCHING_WEIGHT_RECOMMENDATION',
  WEIGHT_DISTRIBUTION: 'MATCHING_WEIGHT_DISTRIBUTION',
  WEIGHT_QUALITY_RATING: 'MATCHING_WEIGHT_QUALITY_RATING',
  WEIGHT_PLAN: 'MATCHING_WEIGHT_PLAN',
  COMPLIANCE_PENALTY: 'MATCHING_COMPLIANCE_PENALTY',
  RESPONSE_PENALTY: 'MATCHING_RESPONSE_PENALTY',
  REPUTATION_DECAY_DAYS: 'MATCHING_REPUTATION_DECAY_DAYS',
  MAX_ACTIVE_REQUESTS: 'MATCHING_MAX_ACTIVE_REQUESTS',
  DISTRIBUTION_DAILY_BONUS: 'MATCHING_DISTRIBUTION_DAILY_BONUS',
  TRIAL_REQUESTS_LIMIT: 'TRIAL_REQUESTS_LIMIT',
  BADGE_BONUS: 'MATCHING_BADGE_BONUS',
  REJECTION_PENALTY: 'MATCHING_REJECTION_PENALTY',
  TENDENCY_WEIGHT: 'MATCHING_TENDENCY_WEIGHT',
} as const;

export class MatchingService {
  constructor(
    private readonly matchingRepository: MatchingRepository,
    private readonly configRepository: ConfigRepository,
  ) {}

  async findBestCandidate(
    categoryId: string,
    geoNodeId: string,
    excludedProfessionalIds: string[],
  ): Promise<MatchResult | null> {
    const config = await this.loadScoringConfig();

    const eligible =
      await this.matchingRepository.findEligibleProfessionals(
        categoryId,
        geoNodeId,
        excludedProfessionalIds,
      );

    console.log('[Matching] findBestCandidate:', {
      categoryId,
      geoNodeId,
      excludedCount: excludedProfessionalIds.length,
      eligibleCount: eligible.length,
      eligibleNames: eligible.map((p) => `${p.name} (${p.id})`),
    });

    if (eligible.length === 0) {
      return null;
    }

    const candidateIds = eligible.map((p) => p.id);

    const filtered = await this.applyHardFilters(
      eligible,
      candidateIds,
      config,
    );

    console.log('[Matching] after hard filters:', {
      filteredCount: filtered.length,
      filteredNames: filtered.map((p) => p.id),
    });

    if (filtered.length === 0) {
      return null;
    }

    const scored = await this.scoreProfessionals(
      filtered.map((p) => p.id),
      config,
    );

    if (scored.length === 0) {
      return null;
    }

    scored.sort((a, b) => b.score - a.score);

    return scored[0];
  }

  async calculateScore(professionalId: string): Promise<number> {
    const config = await this.loadScoringConfig();

    const professional =
      await this.matchingRepository.findProfessionalById(professionalId);

    if (!professional) {
      throw new Error('Professional not found');
    }

    return this.computeScore(professionalId, config);
  }

  // --- Hard filters ---

  private async applyHardFilters(
    professionals: { id: string; name: string; phone: string }[],
    ids: string[],
    config: ScoringConfig,
  ): Promise<{ id: string; name: string; phone: string }[]> {
    const [memberships, trialMap, activeRequestCounts] = await Promise.all([
      this.matchingRepository.getActiveMemberships(ids),
      this.matchingRepository.getTrialRequestsUsed(ids),
      this.matchingRepository.countActiveRequests(ids),
    ]);

    return professionals.filter((p) => {
      const membership = memberships.get(p.id) ?? null;
      const trialUsed = trialMap.get(p.id) ?? 0;

      if (!this.canReceiveRequests(membership, trialUsed, config)) {
        return false;
      }

      const activeCount = activeRequestCounts.get(p.id) ?? 0;
      if (activeCount >= config.maxActiveRequests) {
        return false;
      }

      return true;
    });
  }

  private canReceiveRequests(
    membership: Membership | null,
    trialRequestsUsed: number,
    config: ScoringConfig,
  ): boolean {
    if (membership && membership.endDate > new Date()) {
      return true;
    }
    return trialRequestsUsed < config.trialRequestsLimit;
  }

  // --- Scoring ---

  private async scoreProfessionals(
    ids: string[],
    config: ScoringConfig,
  ): Promise<MatchResult[]> {
    const [
      notFulfilled,
      noResponseCounts,
      feedbackStats,
      lastAssignedDates,
      averageRatings,
      recentRatings,
      rejectedCounts,
      badgeStatus,
      planPriorities,
    ] = await Promise.all([
      this.matchingRepository.findNotFulfilledEvents(ids),
      this.matchingRepository.countNoResponseEvents(ids),
      this.matchingRepository.getFeedbackStats(ids),
      this.matchingRepository.getLastAssignedDates(ids),
      this.matchingRepository.getAverageRatings(ids),
      this.matchingRepository.getRecentAverageRatings(ids),
      this.matchingRepository.countRejectedEvents(ids),
      this.matchingRepository.getBadgeStatus(ids),
      this.matchingRepository.getPlanPriorities(ids),
    ]);

    return ids.map((id) => ({
      professionalId: id,
      score: this.computeScoreFromData(
        id,
        notFulfilled,
        noResponseCounts,
        feedbackStats,
        lastAssignedDates,
        averageRatings,
        recentRatings,
        rejectedCounts,
        badgeStatus,
        planPriorities,
        config,
      ),
    }));
  }

  private async computeScore(
    professionalId: string,
    config: ScoringConfig,
  ): Promise<number> {
    const [
      notFulfilled,
      noResponseCounts,
      feedbackStats,
      lastAssignedDates,
      averageRatings,
      recentRatings,
      rejectedCounts,
      badgeStatus,
      planPriorities,
    ] = await Promise.all([
      this.matchingRepository.findNotFulfilledEvents([professionalId]),
      this.matchingRepository.countNoResponseEvents([professionalId]),
      this.matchingRepository.getFeedbackStats([professionalId]),
      this.matchingRepository.getLastAssignedDates([professionalId]),
      this.matchingRepository.getAverageRatings([professionalId]),
      this.matchingRepository.getRecentAverageRatings([professionalId]),
      this.matchingRepository.countRejectedEvents([professionalId]),
      this.matchingRepository.getBadgeStatus([professionalId]),
      this.matchingRepository.getPlanPriorities([professionalId]),
    ]);

    return this.computeScoreFromData(
      professionalId,
      notFulfilled,
      noResponseCounts,
      feedbackStats,
      lastAssignedDates,
      averageRatings,
      recentRatings,
      rejectedCounts,
      badgeStatus,
      planPriorities,
      config,
    );
  }

  private computeScoreFromData(
    professionalId: string,
    notFulfilled: { professionalId: string; createdAt: Date }[],
    noResponseCounts: Map<string, number>,
    feedbackStats: Map<string, { total: number; wouldRecommend: number }>,
    lastAssignedDates: Map<string, Date | null>,
    averageRatings: Map<string, number | null>,
    recentRatings: Map<string, number | null>,
    rejectedCounts: Map<string, number>,
    badgeStatus: Map<string, boolean>,
    planPriorities: Map<string, number>,
    config: ScoringConfig,
  ): number {
    const compliance = this.computeCompliance(professionalId, notFulfilled, config);
    const response = this.computeResponseRate(professionalId, noResponseCounts, config);
    const recommendation = this.computeRecommendation(professionalId, feedbackStats);
    const distribution = this.computeDistribution(
      professionalId,
      lastAssignedDates,
      rejectedCounts,
      config,
    );
    const qualityRating = this.computeQualityRating(
      professionalId,
      averageRatings,
      recentRatings,
      config,
    );
    const planScore = this.computePlanScore(professionalId, planPriorities);
    const hasBadge = badgeStatus.get(professionalId) ?? false;

    const baseScore =
      compliance * config.weightCompliance +
      response * config.weightResponseRate +
      recommendation * config.weightRecommendation +
      distribution * config.weightDistribution +
      qualityRating * config.weightQualityRating +
      planScore * config.weightPlan;

    const badgeBonus = hasBadge ? config.badgeBonus : 0;

    return Math.min(100, baseScore + badgeBonus);
  }

  private computeCompliance(
    professionalId: string,
    notFulfilledEvents: { professionalId: string; createdAt: Date }[],
    config: ScoringConfig,
  ): number {
    const now = Date.now();
    const decayMs = config.reputationDecayDays * 24 * 60 * 60 * 1000;

    let penalty = 0;

    for (const event of notFulfilledEvents) {
      if (event.professionalId !== professionalId) continue;

      const age = now - event.createdAt.getTime();
      if (age >= decayMs) continue;

      const decayFactor = 1 - age / decayMs;
      penalty += config.compliancePenalty * decayFactor;
    }

    return Math.max(0, 100 - penalty);
  }

  private computeResponseRate(
    professionalId: string,
    noResponseCounts: Map<string, number>,
    config: ScoringConfig,
  ): number {
    const count = noResponseCounts.get(professionalId) ?? 0;
    return Math.max(0, 100 - count * config.responsePenalty);
  }

  private computeRecommendation(
    professionalId: string,
    feedbackStats: Map<string, { total: number; wouldRecommend: number }>,
  ): number {
    const stats = feedbackStats.get(professionalId);

    if (!stats || stats.total === 0) {
      return 50;
    }

    return (stats.wouldRecommend / stats.total) * 100;
  }

  private computeDistribution(
    professionalId: string,
    lastAssignedDates: Map<string, Date | null>,
    rejectedCounts: Map<string, number>,
    config: ScoringConfig,
  ): number {
    const lastAssignedAt = lastAssignedDates.get(professionalId);
    const rejections = rejectedCounts.get(professionalId) ?? 0;

    let base = 100;
    if (lastAssignedAt) {
      const daysSince = Math.floor(
        (Date.now() - lastAssignedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      base = Math.min(100, daysSince * config.distributionDailyBonus);
    }

    const rejectionPenalty = rejections * config.rejectionPenalty;
    return Math.max(0, base - rejectionPenalty);
  }

  private computeQualityRating(
    professionalId: string,
    averageRatings: Map<string, number | null>,
    recentRatings: Map<string, number | null>,
    config: ScoringConfig,
  ): number {
    const historicAvg = averageRatings.get(professionalId) ?? null;
    const recentAvg = recentRatings.get(professionalId) ?? null;

    if (historicAvg === null) return 60;

    const normalizedHistoric = ((historicAvg - 1) / 4) * 100;

    if (recentAvg !== null) {
      const normalizedRecent = ((recentAvg - 1) / 4) * 100;
      const tendency = normalizedRecent - normalizedHistoric;
      const tendencyBonus = Math.max(-15, Math.min(15, tendency * config.tendencyWeight));
      return Math.max(0, Math.min(100, normalizedHistoric + tendencyBonus));
    }

    return normalizedHistoric;
  }

  private computePlanScore(
    professionalId: string,
    planPriorities: Map<string, number>,
  ): number {
    const priority = planPriorities.get(professionalId) ?? 0;
    return Math.min(100, (priority / 3) * 100);
  }

  // --- Config ---

  private async loadScoringConfig(): Promise<ScoringConfig> {
    const entries = await this.configRepository.findAll();
    const map = new Map(entries.map((e) => [e.key, e.value]));

    const getFloat = (key: string, fallback: number): number => {
      const raw = map.get(key);
      if (raw === undefined) return fallback;
      const parsed = parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const getInt = (key: string, fallback: number): number => {
      const raw = map.get(key);
      if (raw === undefined) return fallback;
      const parsed = parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    return {
      weightCompliance: getFloat(CONFIG_KEYS.WEIGHT_COMPLIANCE, DEFAULT_WEIGHT_COMPLIANCE),
      weightResponseRate: getFloat(CONFIG_KEYS.WEIGHT_RESPONSE_RATE, DEFAULT_WEIGHT_RESPONSE_RATE),
      weightRecommendation: getFloat(CONFIG_KEYS.WEIGHT_RECOMMENDATION, DEFAULT_WEIGHT_RECOMMENDATION),
      weightDistribution: getFloat(CONFIG_KEYS.WEIGHT_DISTRIBUTION, DEFAULT_WEIGHT_DISTRIBUTION),
      weightQualityRating: getFloat(CONFIG_KEYS.WEIGHT_QUALITY_RATING, DEFAULT_WEIGHT_QUALITY_RATING),
      weightPlan: getFloat(CONFIG_KEYS.WEIGHT_PLAN, DEFAULT_WEIGHT_PLAN),
      compliancePenalty: getInt(CONFIG_KEYS.COMPLIANCE_PENALTY, DEFAULT_COMPLIANCE_PENALTY),
      responsePenalty: getInt(CONFIG_KEYS.RESPONSE_PENALTY, DEFAULT_RESPONSE_PENALTY),
      reputationDecayDays: getInt(CONFIG_KEYS.REPUTATION_DECAY_DAYS, DEFAULT_REPUTATION_DECAY_DAYS),
      maxActiveRequests: getInt(CONFIG_KEYS.MAX_ACTIVE_REQUESTS, DEFAULT_MAX_ACTIVE_REQUESTS),
      distributionDailyBonus: getInt(CONFIG_KEYS.DISTRIBUTION_DAILY_BONUS, DEFAULT_DISTRIBUTION_DAILY_BONUS),
      trialRequestsLimit: getInt(CONFIG_KEYS.TRIAL_REQUESTS_LIMIT, DEFAULT_TRIAL_REQUESTS_LIMIT),
      badgeBonus: getFloat(CONFIG_KEYS.BADGE_BONUS, DEFAULT_BADGE_BONUS),
      rejectionPenalty: getFloat(CONFIG_KEYS.REJECTION_PENALTY, DEFAULT_REJECTION_PENALTY),
      tendencyWeight: getFloat(CONFIG_KEYS.TENDENCY_WEIGHT, DEFAULT_TENDENCY_WEIGHT),
    };
  }
}
