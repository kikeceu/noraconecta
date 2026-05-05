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
  compliancePenalty: number;
  responsePenalty: number;
  reputationDecayDays: number;
  maxActiveRequests: number;
  distributionDailyBonus: number;
  trialRequestsLimit: number;
}

const DEFAULT_WEIGHT_COMPLIANCE = 0.5;
const DEFAULT_WEIGHT_RESPONSE_RATE = 0.3;
const DEFAULT_WEIGHT_RECOMMENDATION = 0.1;
const DEFAULT_WEIGHT_DISTRIBUTION = 0.1;
const DEFAULT_COMPLIANCE_PENALTY = 50;
const DEFAULT_RESPONSE_PENALTY = 25;
const DEFAULT_REPUTATION_DECAY_DAYS = 90;
const DEFAULT_MAX_ACTIVE_REQUESTS = 2;
const DEFAULT_DISTRIBUTION_DAILY_BONUS = 10;
const DEFAULT_TRIAL_REQUESTS_LIMIT = 3;

const CONFIG_KEYS = {
  WEIGHT_COMPLIANCE: 'MATCHING_WEIGHT_COMPLIANCE',
  WEIGHT_RESPONSE_RATE: 'MATCHING_WEIGHT_RESPONSE_RATE',
  WEIGHT_RECOMMENDATION: 'MATCHING_WEIGHT_RECOMMENDATION',
  WEIGHT_DISTRIBUTION: 'MATCHING_WEIGHT_DISTRIBUTION',
  COMPLIANCE_PENALTY: 'MATCHING_COMPLIANCE_PENALTY',
  RESPONSE_PENALTY: 'MATCHING_RESPONSE_PENALTY',
  REPUTATION_DECAY_DAYS: 'MATCHING_REPUTATION_DECAY_DAYS',
  MAX_ACTIVE_REQUESTS: 'MATCHING_MAX_ACTIVE_REQUESTS',
  DISTRIBUTION_DAILY_BONUS: 'MATCHING_DISTRIBUTION_DAILY_BONUS',
  TRIAL_REQUESTS_LIMIT: 'TRIAL_REQUESTS_LIMIT',
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

    const planPriorities = await this.matchingRepository.getPlanPriorities(
      scored.map((s) => s.professionalId),
    );

    scored.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) < 5) {
        const aPriority = planPriorities.get(a.professionalId) ?? 1;
        const bPriority = planPriorities.get(b.professionalId) ?? 1;
        return bPriority - aPriority;
      }
      return scoreDiff;
    });

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
    professionals: { id: string; phone: string }[],
    ids: string[],
    config: ScoringConfig,
  ): Promise<{ id: string; phone: string }[]> {
    const [memberships, trialMap, activeRequestCounts] = await Promise.all([
      this.matchingRepository.getActiveMemberships(ids),
      this.matchingRepository.getTrialRequestsUsed(ids),
      this.matchingRepository.countActiveRequests(ids),
    ]);

    return professionals.filter((p) => {
      if (!this.canReceiveRequests(memberships.get(p.id) ?? null, trialMap.get(p.id) ?? 0, config)) {
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
    const [notFulfilled, noResponseCounts, feedbackStats, lastAssignedDates] =
      await Promise.all([
        this.matchingRepository.findNotFulfilledEvents(ids),
        this.matchingRepository.countNoResponseEvents(ids),
        this.matchingRepository.getFeedbackStats(ids),
        this.matchingRepository.getLastAssignedDates(ids),
      ]);

    return ids.map((id) => ({
      professionalId: id,
      score: this.computeScoreFromData(
        id,
        notFulfilled,
        noResponseCounts,
        feedbackStats,
        lastAssignedDates,
        config,
      ),
    }));
  }

  private async computeScore(
    professionalId: string,
    config: ScoringConfig,
  ): Promise<number> {
    const [notFulfilled, noResponseCounts, feedbackStats, lastAssignedDates] =
      await Promise.all([
        this.matchingRepository.findNotFulfilledEvents([professionalId]),
        this.matchingRepository.countNoResponseEvents([professionalId]),
        this.matchingRepository.getFeedbackStats([professionalId]),
        this.matchingRepository.getLastAssignedDates([professionalId]),
      ]);

    return this.computeScoreFromData(
      professionalId,
      notFulfilled,
      noResponseCounts,
      feedbackStats,
      lastAssignedDates,
      config,
    );
  }

  private computeScoreFromData(
    professionalId: string,
    notFulfilled: { professionalId: string; createdAt: Date }[],
    noResponseCounts: Map<string, number>,
    feedbackStats: Map<string, { total: number; wouldRecommend: number }>,
    lastAssignedDates: Map<string, Date | null>,
    config: ScoringConfig,
  ): number {
    const compliance = this.computeCompliance(professionalId, notFulfilled, config);
    const response = this.computeResponseRate(professionalId, noResponseCounts, config);
    const recommendation = this.computeRecommendation(professionalId, feedbackStats);
    const distribution = this.computeDistribution(professionalId, lastAssignedDates, config);

    return (
      compliance * config.weightCompliance +
      response * config.weightResponseRate +
      recommendation * config.weightRecommendation +
      distribution * config.weightDistribution
    );
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
    config: ScoringConfig,
  ): number {
    const lastAssignedAt = lastAssignedDates.get(professionalId);

    if (!lastAssignedAt) {
      return 100;
    }

    const daysSince = Math.floor(
      (Date.now() - lastAssignedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return Math.min(100, daysSince * config.distributionDailyBonus);
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
      compliancePenalty: getInt(CONFIG_KEYS.COMPLIANCE_PENALTY, DEFAULT_COMPLIANCE_PENALTY),
      responsePenalty: getInt(CONFIG_KEYS.RESPONSE_PENALTY, DEFAULT_RESPONSE_PENALTY),
      reputationDecayDays: getInt(CONFIG_KEYS.REPUTATION_DECAY_DAYS, DEFAULT_REPUTATION_DECAY_DAYS),
      maxActiveRequests: getInt(CONFIG_KEYS.MAX_ACTIVE_REQUESTS, DEFAULT_MAX_ACTIVE_REQUESTS),
      distributionDailyBonus: getInt(CONFIG_KEYS.DISTRIBUTION_DAILY_BONUS, DEFAULT_DISTRIBUTION_DAILY_BONUS),
      trialRequestsLimit: getInt(CONFIG_KEYS.TRIAL_REQUESTS_LIMIT, DEFAULT_TRIAL_REQUESTS_LIMIT),
    };
  }
}
