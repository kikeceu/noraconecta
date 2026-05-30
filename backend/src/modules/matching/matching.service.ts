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
  weightQualityRating: number;
  weightProximity: number;
  weightRecommendation: number;
  weightDistribution: number;
  weightPlan: number;
  weightAcceptance: number;
  weightCompletion: number;
  weightResponseTime: number;
  maxDistanceKm: number;
  compliancePenalty: number;
  responsePenalty: number;
  reputationDecayDays: number;
  maxActiveRequests: number;
  distributionDailyBonus: number;
  trialRequestsLimit: number;
  badgeBonus: number;
  rejectionPenalty: number;
  tendencyWeight: number;
  weightSentiment: number;
}

const DEFAULT_WEIGHT_COMPLIANCE = 0.17;
const DEFAULT_WEIGHT_RESPONSE_RATE = 0.20;
const DEFAULT_WEIGHT_QUALITY_RATING = 0.15;
const DEFAULT_WEIGHT_PROXIMITY = 0.10;
const DEFAULT_WEIGHT_RECOMMENDATION = 0.10;
const DEFAULT_WEIGHT_DISTRIBUTION = 0.05;
const DEFAULT_WEIGHT_PLAN = 0.05;
const DEFAULT_WEIGHT_ACCEPTANCE = 0.05;
const DEFAULT_WEIGHT_COMPLETION = 0.05;
const DEFAULT_WEIGHT_RESPONSE_TIME = 0.03;
const DEFAULT_MAX_DISTANCE_KM = 50;
const DEFAULT_COMPLIANCE_PENALTY = 50;
const DEFAULT_RESPONSE_PENALTY = 25;
const DEFAULT_REPUTATION_DECAY_DAYS = 90;
const DEFAULT_MAX_ACTIVE_REQUESTS = 2;
const DEFAULT_DISTRIBUTION_DAILY_BONUS = 10;
const DEFAULT_TRIAL_REQUESTS_LIMIT = 3;
const DEFAULT_BADGE_BONUS = 5;
const DEFAULT_REJECTION_PENALTY = 10;
const DEFAULT_TENDENCY_WEIGHT = 0.15;
const DEFAULT_WEIGHT_SENTIMENT = 0.05;

const CONFIG_KEYS = {
  WEIGHT_COMPLIANCE: 'MATCHING_WEIGHT_COMPLIANCE',
  WEIGHT_RESPONSE_RATE: 'MATCHING_WEIGHT_RESPONSE_RATE',
  WEIGHT_QUALITY_RATING: 'MATCHING_WEIGHT_QUALITY_RATING',
  WEIGHT_PROXIMITY: 'MATCHING_WEIGHT_PROXIMITY',
  WEIGHT_RECOMMENDATION: 'MATCHING_WEIGHT_RECOMMENDATION',
  WEIGHT_DISTRIBUTION: 'MATCHING_WEIGHT_DISTRIBUTION',
  WEIGHT_PLAN: 'MATCHING_WEIGHT_PLAN',
  WEIGHT_ACCEPTANCE: 'MATCHING_WEIGHT_ACCEPTANCE',
  WEIGHT_COMPLETION: 'MATCHING_WEIGHT_COMPLETION',
  WEIGHT_RESPONSE_TIME: 'MATCHING_WEIGHT_RESPONSE_TIME',
  MAX_DISTANCE_KM: 'MATCHING_MAX_DISTANCE_KM',
  COMPLIANCE_PENALTY: 'MATCHING_COMPLIANCE_PENALTY',
  RESPONSE_PENALTY: 'MATCHING_RESPONSE_PENALTY',
  REPUTATION_DECAY_DAYS: 'MATCHING_REPUTATION_DECAY_DAYS',
  MAX_ACTIVE_REQUESTS: 'MATCHING_MAX_ACTIVE_REQUESTS',
  DISTRIBUTION_DAILY_BONUS: 'MATCHING_DISTRIBUTION_DAILY_BONUS',
  TRIAL_REQUESTS_LIMIT: 'TRIAL_REQUESTS_LIMIT',
  BADGE_BONUS: 'MATCHING_BADGE_BONUS',
  REJECTION_PENALTY: 'MATCHING_REJECTION_PENALTY',
  TENDENCY_WEIGHT: 'MATCHING_TENDENCY_WEIGHT',
  WEIGHT_SENTIMENT: 'MATCHING_WEIGHT_SENTIMENT',
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
    userLatitude: number | null,
    userLongitude: number | null,
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
      userLatitude,
      userLongitude,
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
    userLat: number | null,
    userLon: number | null,
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
      professionalCoords,
      acceptanceRates,
      completionRates,
      avgResponseTimes,
      sentimentScores,
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
      this.matchingRepository.getProfessionalCoordinates(ids),
      this.matchingRepository.getAcceptanceRates(ids),
      this.matchingRepository.getCompletionRates(ids),
      this.matchingRepository.getAvgResponseTimes(ids),
      this.matchingRepository.getSentimentScores(ids),
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
        userLat,
        userLon,
        professionalCoords,
        acceptanceRates,
        completionRates,
        avgResponseTimes,
        sentimentScores,
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
      professionalCoords,
      acceptanceRates,
      completionRates,
      avgResponseTimes,
      sentimentScores,
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
      this.matchingRepository.getProfessionalCoordinates([professionalId]),
      this.matchingRepository.getAcceptanceRates([professionalId]),
      this.matchingRepository.getCompletionRates([professionalId]),
      this.matchingRepository.getAvgResponseTimes([professionalId]),
      this.matchingRepository.getSentimentScores([professionalId]),
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
      null,
      null,
      professionalCoords,
      acceptanceRates,
      completionRates,
      avgResponseTimes,
      sentimentScores,
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
    userLat: number | null,
    userLon: number | null,
    professionalCoords: Map<string, { latitude: number | null; longitude: number | null }>,
    acceptanceRates: Map<string, number>,
    completionRates: Map<string, number>,
    avgResponseTimes: Map<string, number>,
    sentimentScores: Map<string, number>,
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
    const proximity = this.computeProximity(
      professionalId,
      userLat,
      userLon,
      professionalCoords,
      config,
    );
    const acceptance = this.computeAcceptance(professionalId, acceptanceRates);
    const completion = this.computeCompletion(professionalId, completionRates);
    const responseTime = this.computeResponseTime(professionalId, avgResponseTimes);
    const hasBadge = badgeStatus.get(professionalId) ?? false;
    const sentiment = this.computeSentiment(professionalId, sentimentScores);

    const baseScore =
      compliance * config.weightCompliance +
      response * config.weightResponseRate +
      qualityRating * config.weightQualityRating +
      proximity * config.weightProximity +
      recommendation * config.weightRecommendation +
      distribution * config.weightDistribution +
      planScore * config.weightPlan +
      acceptance * config.weightAcceptance +
      completion * config.weightCompletion +
      responseTime * config.weightResponseTime +
      sentiment * config.weightSentiment;

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

  private computeAcceptance(
    professionalId: string,
    acceptanceRates: Map<string, number>,
  ): number {
    const rate = acceptanceRates.get(professionalId) ?? 0.5;
    return rate * 100;
  }

  private computeCompletion(
    professionalId: string,
    completionRates: Map<string, number>,
  ): number {
    const rate = completionRates.get(professionalId) ?? 0.5;
    return rate * 100;
  }

  private computeResponseTime(
    professionalId: string,
    avgResponseTimes: Map<string, number>,
  ): number {
    const avgMinutes = avgResponseTimes.get(professionalId) ?? 60;
    return Math.max(0, 100 - (avgMinutes / 120) * 100);
  }

  private computeSentiment(
    professionalId: string,
    sentimentScores: Map<string, number>,
  ): number {
    return sentimentScores.get(professionalId) ?? 50;
  }

  private haversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const earthRadiusKm = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private computeProximity(
    professionalId: string,
    userLat: number | null,
    userLon: number | null,
    professionalCoords: Map<string, { latitude: number | null; longitude: number | null }>,
    config: ScoringConfig,
  ): number {
    const coords = professionalCoords.get(professionalId);

    if (
      userLat === null ||
      userLon === null ||
      !coords ||
      coords.latitude === null ||
      coords.longitude === null
    ) {
      return 50;
    }

    const distanceKm = this.haversineDistanceKm(
      userLat,
      userLon,
      coords.latitude,
      coords.longitude,
    );

    const score = Math.max(0, 100 - (distanceKm / config.maxDistanceKm) * 100);
    return Math.min(100, score);
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
      weightQualityRating: getFloat(CONFIG_KEYS.WEIGHT_QUALITY_RATING, DEFAULT_WEIGHT_QUALITY_RATING),
      weightProximity: getFloat(CONFIG_KEYS.WEIGHT_PROXIMITY, DEFAULT_WEIGHT_PROXIMITY),
      weightRecommendation: getFloat(CONFIG_KEYS.WEIGHT_RECOMMENDATION, DEFAULT_WEIGHT_RECOMMENDATION),
      weightDistribution: getFloat(CONFIG_KEYS.WEIGHT_DISTRIBUTION, DEFAULT_WEIGHT_DISTRIBUTION),
      weightPlan: getFloat(CONFIG_KEYS.WEIGHT_PLAN, DEFAULT_WEIGHT_PLAN),
      weightAcceptance: getFloat(CONFIG_KEYS.WEIGHT_ACCEPTANCE, DEFAULT_WEIGHT_ACCEPTANCE),
      weightCompletion: getFloat(CONFIG_KEYS.WEIGHT_COMPLETION, DEFAULT_WEIGHT_COMPLETION),
      weightResponseTime: getFloat(CONFIG_KEYS.WEIGHT_RESPONSE_TIME, DEFAULT_WEIGHT_RESPONSE_TIME),
      maxDistanceKm: getFloat(CONFIG_KEYS.MAX_DISTANCE_KM, DEFAULT_MAX_DISTANCE_KM),
      compliancePenalty: getInt(CONFIG_KEYS.COMPLIANCE_PENALTY, DEFAULT_COMPLIANCE_PENALTY),
      responsePenalty: getInt(CONFIG_KEYS.RESPONSE_PENALTY, DEFAULT_RESPONSE_PENALTY),
      reputationDecayDays: getInt(CONFIG_KEYS.REPUTATION_DECAY_DAYS, DEFAULT_REPUTATION_DECAY_DAYS),
      maxActiveRequests: getInt(CONFIG_KEYS.MAX_ACTIVE_REQUESTS, DEFAULT_MAX_ACTIVE_REQUESTS),
      distributionDailyBonus: getInt(CONFIG_KEYS.DISTRIBUTION_DAILY_BONUS, DEFAULT_DISTRIBUTION_DAILY_BONUS),
      trialRequestsLimit: getInt(CONFIG_KEYS.TRIAL_REQUESTS_LIMIT, DEFAULT_TRIAL_REQUESTS_LIMIT),
      badgeBonus: getFloat(CONFIG_KEYS.BADGE_BONUS, DEFAULT_BADGE_BONUS),
      rejectionPenalty: getFloat(CONFIG_KEYS.REJECTION_PENALTY, DEFAULT_REJECTION_PENALTY),
      tendencyWeight: getFloat(CONFIG_KEYS.TENDENCY_WEIGHT, DEFAULT_TENDENCY_WEIGHT),
      weightSentiment: getFloat(CONFIG_KEYS.WEIGHT_SENTIMENT, DEFAULT_WEIGHT_SENTIMENT),
    };
  }
}
