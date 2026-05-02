import { RequestsRepository } from './requests.repository';
import { MatchingService } from '../matching/matching.service';
import { MatchingRepository } from '../matching/matching.repository';
import { ConfigRepository } from '../config/config.repository';
import { UsersRepository } from '../users/users.repository';
import { ReputationService } from '../reputation/reputation.service';
import { ReputationRepository } from '../reputation/reputation.repository';
import { EscalationsService } from '../escalations/escalations.service';
import { EscalationsRepository } from '../escalations/escalations.repository';
import { AppError } from '../../middleware/error-handler';
import prisma from '../../lib/prisma';
import { Request, Feedback } from '@prisma/client';

const DEFAULT_RESPONSE_TIMEOUT_HOURS = 2;
const DEFAULT_AUTO_COMPLETE_HOURS = 24;

export interface CreateRequestInput {
  phone: string;
  categoryId: string;
  geoNodeId: string;
  description: string;
  photoUrls?: string[];
  audioUrl?: string;
}

export interface PaginatedRequestsResponse {
  data: Request[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const matchingRepository = new MatchingRepository();
const configRepository = new ConfigRepository();
const reputationRepository = new ReputationRepository();
const escalationsRepository = new EscalationsRepository();

export class RequestsService {
  private readonly matchingService: MatchingService;

  constructor(
    private readonly requestsRepository: RequestsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly reputationService = new ReputationService(reputationRepository),
    private readonly escalationsService = new EscalationsService(escalationsRepository),
  ) {
    this.matchingService = new MatchingService(matchingRepository, configRepository);
  }

  async create(input: CreateRequestInput): Promise<Request> {
    const trimmedPhone = input.phone.trim();

    if (!trimmedPhone) {
      throw new AppError('Phone is required', 400);
    }

    if (!input.categoryId) {
      throw new AppError('Category is required', 400);
    }

    if (!input.geoNodeId) {
      throw new AppError('Geo node is required', 400);
    }

    if (!input.description || !input.description.trim()) {
      throw new AppError('Description is required', 400);
    }

    const user = await this.usersRepository.findByPhone(trimmedPhone);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.status === 'BLOCKED') {
      throw new AppError('User is blocked', 403);
    }

    const activeRequest = await this.requestsRepository.findActiveByUserId(user.id);

    if (activeRequest) {
      throw new AppError('User already has an active request', 409);
    }

    const match = await this.matchingService.findBestCandidate(
      input.categoryId,
      input.geoNodeId,
      [],
    );

    const responseTimeoutHours = await this.getResponseTimeoutHours();
    const now = new Date();
    const assignmentTimeoutAt = match
      ? new Date(now.getTime() + responseTimeoutHours * 60 * 60 * 1000)
      : undefined;

    const status = match ? 'ASSIGNED' : 'NO_RESPONSE';

    const request = await this.requestsRepository.create({
      userId: user.id,
      categoryId: input.categoryId,
      geoNodeId: input.geoNodeId,
      description: input.description.trim(),
      photoUrls: input.photoUrls || [],
      audioUrl: input.audioUrl,
      status,
      assignedProfessionalId: match?.professionalId,
      assignedAt: match ? now : undefined,
      assignmentTimeoutAt,
    });

    await this.requestsRepository.createEvent({
      requestId: request.id,
      professionalId: match?.professionalId ?? null,
      type: match ? 'ASSIGNED' : 'NO_RESPONSE',
    });

    if (match) {
      await this.requestsRepository.updateLastAssignedAt(match.professionalId, now);
    }

    return request;
  }

  async accept(requestId: string): Promise<Request> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'ASSIGNED') {
      throw new AppError(
        `Cannot accept a request with status ${request.status}. Expected ASSIGNED`,
        400,
      );
    }

    if (!request.assignedProfessionalId) {
      throw new AppError('Request has no assigned professional', 400);
    }

    const hasMembership = await this.requestsRepository.professionalHasActiveMembership(
      request.assignedProfessionalId,
    );

    if (!hasMembership) {
      await this.requestsRepository.incrementTrialRequestsUsed(request.assignedProfessionalId);
    }

    const updated = await this.requestsRepository.update(requestId, {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      assignmentTimeoutAt: null,
    });

    await this.requestsRepository.createEvent({
      requestId,
      professionalId: request.assignedProfessionalId,
      type: 'ACCEPTED',
    });

    return updated;
  }

  async reject(requestId: string): Promise<Request> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'ASSIGNED') {
      throw new AppError(
        `Cannot reject a request with status ${request.status}. Expected ASSIGNED`,
        400,
      );
    }

    if (!request.assignedProfessionalId) {
      throw new AppError('Request has no assigned professional', 400);
    }

    await this.requestsRepository.createEvent({
      requestId,
      professionalId: request.assignedProfessionalId,
      type: 'REJECTED',
    });

    const rejectorIds = await this.requestsRepository.findRejectorIds(requestId);

    const match = await this.matchingService.findBestCandidate(
      request.categoryId,
      request.geoNodeId,
      rejectorIds,
    );

    if (!match) {
      const updated = await this.requestsRepository.update(requestId, {
        status: 'NO_RESPONSE',
        assignedProfessionalId: null,
        assignedAt: null,
        assignmentTimeoutAt: null,
      });

      await this.requestsRepository.createEvent({
        requestId,
        type: 'NO_RESPONSE',
      });

      return updated;
    }

    const responseTimeoutHours = await this.getResponseTimeoutHours();
    const now = new Date();
    const assignmentTimeoutAt = new Date(now.getTime() + responseTimeoutHours * 60 * 60 * 1000);

    const updated = await this.requestsRepository.update(requestId, {
      status: 'ASSIGNED',
      assignedProfessionalId: match.professionalId,
      assignedAt: now,
      assignmentTimeoutAt,
    });

    await this.requestsRepository.createEvent({
      requestId,
      professionalId: match.professionalId,
      type: 'ASSIGNED',
    });

    await this.requestsRepository.updateLastAssignedAt(match.professionalId, now);

    return updated;
  }

  async cancel(requestId: string): Promise<Request> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'CREATED' && request.status !== 'ASSIGNED') {
      throw new AppError(
        `Cannot cancel a request with status ${request.status}. Expected CREATED or ASSIGNED`,
        400,
      );
    }

    const updated = await this.requestsRepository.update(requestId, {
      status: 'CANCELLED',
    });

    await this.requestsRepository.createEvent({
      requestId,
      professionalId: request.assignedProfessionalId,
      type: 'CANCELLED',
    });

    return updated;
  }

  async markCompleted(requestId: string): Promise<Request> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'ACCEPTED') {
      throw new AppError(
        `Cannot mark as completed a request with status ${request.status}. Expected ACCEPTED`,
        400,
      );
    }

    return this.requestsRepository.update(requestId, {
      completedAt: new Date(),
    });
  }

  async confirmCompletion(requestId: string, fulfilled: boolean): Promise<Request> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'ACCEPTED') {
      throw new AppError(
        `Cannot confirm completion for a request with status ${request.status}. Expected ACCEPTED`,
        400,
      );
    }

    if (!request.assignedProfessionalId) {
      throw new AppError('Request has no assigned professional', 400);
    }

    if (fulfilled) {
      const updated = await this.requestsRepository.update(requestId, {
        status: 'COMPLETED',
      });

      await this.requestsRepository.createEvent({
        requestId,
        professionalId: request.assignedProfessionalId,
        type: 'COMPLETED',
      });

      await this.reputationService.evaluateBadge(
        request.assignedProfessionalId,
      );

      return updated;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await this.requestsRepository.update(
        requestId,
        { status: 'NOT_FULFILLED' },
        tx,
      );

      await this.requestsRepository.createEvent(
        {
          requestId,
          professionalId: request.assignedProfessionalId,
          type: 'NOT_FULFILLED',
        },
        tx,
      );

      await this.reputationService.applyPenalization(
        request.assignedProfessionalId!,
        tx,
      );

      await this.reputationService.removeBadgeIfActive(
        request.assignedProfessionalId!,
        tx,
      );

      return result;
    });

    return updated;
  }

  async reportNoncompliance(requestId: string): Promise<Request> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'ACCEPTED') {
      throw new AppError(
        `Cannot report noncompliance for a request with status ${request.status}. Expected ACCEPTED`,
        400,
      );
    }

    if (!request.assignedProfessionalId) {
      throw new AppError('Request has no assigned professional', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await this.requestsRepository.update(
        requestId,
        { status: 'NOT_FULFILLED' },
        tx,
      );

      await this.requestsRepository.createEvent(
        {
          requestId,
          professionalId: request.assignedProfessionalId,
          type: 'NOT_FULFILLED',
        },
        tx,
      );

      await this.escalationsService.create(
        requestId,
        request.userId,
        request.assignedProfessionalId!,
        tx,
      );

      await this.reputationService.applyPenalization(
        request.assignedProfessionalId!,
        tx,
      );

      await this.reputationService.removeBadgeIfActive(
        request.assignedProfessionalId!,
        tx,
      );

      return result;
    });

    return updated;
  }

  async submitFeedback(
    requestId: string,
    workCompleted: boolean,
    wouldRecommend: boolean,
    comment?: string,
  ): Promise<Feedback> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'COMPLETED') {
      throw new AppError(
        `Cannot submit feedback for a request with status ${request.status}. Expected COMPLETED`,
        400,
      );
    }

    const existing = await this.requestsRepository.findFeedbackByRequestId(requestId);

    if (existing) {
      throw new AppError('Feedback already submitted for this request', 409);
    }

    return this.requestsRepository.createFeedback({
      requestId,
      workCompleted,
      wouldRecommend,
      comment,
    });
  }

  async list(page: number = 1, limit: number = 20): Promise<PaginatedRequestsResponse> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    const { requests, total } = await this.requestsRepository.findAll(skip, validLimit);

    return {
      data: requests,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  async getById(id: string): Promise<Request> {
    const request = await this.requestsRepository.findById(id);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    return request;
  }

  async processTimeouts(): Promise<number> {
    const expired = await this.requestsRepository.findExpiredAssignments(new Date());
    let processed = 0;

    for (const request of expired) {
      try {
        if (request.assignedProfessionalId) {
          await this.requestsRepository.createEvent({
            requestId: request.id,
            professionalId: request.assignedProfessionalId,
            type: 'NO_RESPONSE',
          });
        }

        const rejectorIds = await this.requestsRepository.findRejectorIds(request.id);

        const excludedIds = new Set(rejectorIds);

        if (request.assignedProfessionalId) {
          excludedIds.add(request.assignedProfessionalId);
        }

        const match = await this.matchingService.findBestCandidate(
          request.categoryId,
          request.geoNodeId,
          [...excludedIds],
        );

        if (!match) {
          await this.requestsRepository.update(request.id, {
            status: 'NO_RESPONSE',
            assignedProfessionalId: null,
            assignedAt: null,
            assignmentTimeoutAt: null,
          });

          await this.requestsRepository.createEvent({
            requestId: request.id,
            type: 'NO_RESPONSE',
          });
        } else {
          const responseTimeoutHours = await this.getResponseTimeoutHours();
          const now = new Date();
          const assignmentTimeoutAt = new Date(now.getTime() + responseTimeoutHours * 60 * 60 * 1000);

          await this.requestsRepository.update(request.id, {
            status: 'ASSIGNED',
            assignedProfessionalId: match.professionalId,
            assignedAt: now,
            assignmentTimeoutAt,
          });

          await this.requestsRepository.createEvent({
            requestId: request.id,
            professionalId: match.professionalId,
            type: 'ASSIGNED',
          });

          await this.requestsRepository.updateLastAssignedAt(match.professionalId, now);
        }

        processed++;
      } catch {
        // Continue processing remaining requests
      }
    }

    return processed;
  }

  async processAutoCompletes(): Promise<number> {
    const autoCompleteHours = await this.getAutoCompleteHours();
    const cutoff = new Date(Date.now() - autoCompleteHours * 60 * 60 * 1000);

    const pending = await this.requestsRepository.findPendingAutoComplete(cutoff);
    let processed = 0;

    for (const request of pending) {
      try {
        await this.requestsRepository.update(request.id, {
          status: 'COMPLETED',
        });

        await this.requestsRepository.createEvent({
          requestId: request.id,
          professionalId: request.assignedProfessionalId,
          type: 'COMPLETED',
        });

        if (request.assignedProfessionalId) {
          await this.reputationService.evaluateBadge(
            request.assignedProfessionalId,
          );
        }

        processed++;
      } catch {
        // Continue processing remaining requests
      }
    }

    return processed;
  }

  private async getResponseTimeoutHours(): Promise<number> {
    const config = await configRepository.findByKey('PROFESSIONAL_RESPONSE_TIMEOUT_HOURS');

    if (config) {
      const parsed = parseInt(config.value, 10);

      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return DEFAULT_RESPONSE_TIMEOUT_HOURS;
  }

  private async getAutoCompleteHours(): Promise<number> {
    const config = await configRepository.findByKey('AUTO_COMPLETE_HOURS');

    if (config) {
      const parsed = parseInt(config.value, 10);

      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return DEFAULT_AUTO_COMPLETE_HOURS;
  }
}
