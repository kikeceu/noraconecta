import { RequestsRepository } from './requests.repository';
import { MatchingService } from '../matching/matching.service';
import { MatchingRepository } from '../matching/matching.repository';
import { BotRepository } from '../bot/bot.repository';
import { ConfigRepository } from '../config/config.repository';
import { UsersRepository } from '../users/users.repository';
import { ReputationService } from '../reputation/reputation.service';
import { ReputationRepository } from '../reputation/reputation.repository';
import { EscalationsService } from '../escalations/escalations.service';
import { EscalationsRepository } from '../escalations/escalations.repository';
import { NotificationService } from '../notifications/notification.service';
import { CoordinationService } from '../bot/coordination.service';
import { AppError } from '../../middleware/error-handler';
import prisma from '../../lib/prisma';
import { callLLM } from '../../lib/llm-client';
import { parseExactDate, formatDateTimeArgentina } from '../../utils/date-utils';
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
  userLatitude?: number;
  userLongitude?: number;
  technicalBrief?: string;
}

export type Satisfaction = 'SATISFIED' | 'PARTIAL' | 'UNSATISFIED';

export interface CancelByUserResult {
  request: Request;
  shouldNotifyProfessional: boolean;
  professionalPhone: string | null;
  professionalMessage: string | null;
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

const configRepository = new ConfigRepository();
const reputationRepository = new ReputationRepository();
const escalationsRepository = new EscalationsRepository();

export class RequestsService {
  private readonly matchingService: MatchingService;

  constructor(
    private readonly requestsRepository: RequestsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly matchingRepository: MatchingRepository,
    private readonly botRepository: BotRepository,
    private readonly reputationService = new ReputationService(reputationRepository),
    private readonly escalationsService = new EscalationsService(escalationsRepository),
    private readonly notificationService?: NotificationService,
    private readonly coordinationService?: CoordinationService,
  ) {
    this.matchingService = new MatchingService(this.matchingRepository, configRepository);
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

    const request = await this.requestsRepository.create({
      userId: user.id,
      categoryId: input.categoryId,
      geoNodeId: input.geoNodeId,
      description: input.description.trim(),
      photoUrls: input.photoUrls || [],
      audioUrl: input.audioUrl,
      userLatitude: input.userLatitude,
      userLongitude: input.userLongitude,
      status: 'CREATED',
      technicalBrief: input.technicalBrief,
    });

    let isUrgent = false;
    let mentionedDate: string | null = null;
    let problemType: string | undefined;

    try {
      const category = await prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { name: true },
      });
      const categoryName = category?.name ?? 'desconocido';

      const prompt = `Descripción de un pedido de ${categoryName}: "${input.description.trim()}"

Devolvé SOLO un JSON con este formato exacto:
{
  "problemType": "clasificación en snake_case inglés, máximo 3 palabras",
  "isUrgent": true o false,
  "mentionedDate": "descripción de la fecha/día mencionado o null si no hay"
}

Criterios:
- problemType: clasificación breve. Ejemplos: water_leak, pipe_repair, clog, electrical_short, switch_installation, wall_painting
- isUrgent: true si hay palabras como "urgente", "emergencia", "ahora", "ya", "se inunda", "sin agua", "sin luz"
- mentionedDate: extraer si el usuario menciona un día o fecha. Ej: "el sábado" → "sábado", "mañana" → "mañana", "el 15 de junio" → "15 de junio". Si no menciona fecha, null.`;

      const rawResponse = await callLLM(prompt);
      const trimmed = rawResponse.trim();

      let parsed: { problemType?: string; isUrgent?: boolean; mentionedDate?: string | null } | null = null;

      try {
        parsed = JSON.parse(trimmed);
      } catch {
        const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      }

      if (parsed) {
        problemType = parsed.problemType
          ? parsed.problemType.trim().toLowerCase().replace(/\s+/g, '_')
          : undefined;

        isUrgent = parsed.isUrgent === true;
        mentionedDate =
          parsed.mentionedDate && parsed.mentionedDate !== 'null'
            ? parsed.mentionedDate
            : null;
      }
    } catch {
      // defaults already set — LLM failure is non-blocking
    }

    const match = await this.matchingService.findBestCandidate(
      input.categoryId,
      input.geoNodeId,
      [],
      input.userLatitude ?? null,
      input.userLongitude ?? null,
      problemType,
      isUrgent,
      mentionedDate,
    );

    void this.requestsRepository.update(request.id, {
      problemType: problemType || undefined,
      isUrgent,
      mentionedDate,
    }).catch((err) => {
      console.error('[Requests] failed to update request analysis:', err);
    });

    if (match) {
      const responseTimeoutHours = await this.getResponseTimeoutHours();
      const now = new Date();
      const assignmentTimeoutAt = new Date(
        now.getTime() + responseTimeoutHours * 60 * 60 * 1000,
      );

      const updated = await this.requestsRepository.update(request.id, {
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

      // Notify professional via WhatsApp
      if (this.notificationService) {
        const categoryName = await this.getCategoryName(input.categoryId);
        const zoneName = await this.getZoneName(input.geoNodeId);

        const professional = await prisma.professional.findUnique({
          where: { id: match.professionalId },
          select: { phone: true, name: true },
        });

        if (professional) {
          this.notificationService.notifyProfessionalAssigned(
            professional,
            {
              id: request.id,
              categoryName,
              zoneName,
              description: request.description,
              timeoutHours: responseTimeoutHours,
              photoUrls: request.photoUrls ?? [],
              audioUrl: request.audioUrl || undefined,
              technicalBrief: request.technicalBrief,
            },
          ).catch((err) => {
            console.error('[RequestsService] Failed to notify professional assigned:', err);
          });
        }
      }

      return updated;
    }

    const responseTimeoutHours = await this.getResponseTimeoutHours();
    const now = new Date();
    const assignmentTimeoutAt = new Date(
      now.getTime() + responseTimeoutHours * 60 * 60 * 1000,
    );

    await this.requestsRepository.update(request.id, {
      assignmentTimeoutAt,
    });

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

    // Init coordination and notify user
    const fullRequest = await this.requestsRepository.findByIdWithCoordination(requestId);

    if (fullRequest?.user?.phone && fullRequest?.assignedProfessional?.phone) {
      if (this.coordinationService) {
        this.coordinationService.initAfterAccept({
          requestId: fullRequest.id,
          userId: fullRequest.userId,
          userName: fullRequest.user?.name || 'Usuario',
          userPhone: fullRequest.user.phone,
          professionalId: fullRequest.assignedProfessionalId!,
          professionalName: fullRequest.assignedProfessional?.name || 'Profesional',
          professionalPhone: fullRequest.assignedProfessional.phone,
          categoryName: fullRequest.category?.name || 'el servicio',
          description: fullRequest.description,
        }).catch((err) => {
          console.error('[RequestsService] Failed to init coordination after accept:', err);
        });
      }

      if (this.notificationService) {
        this.notificationService.notifyUserRequestAccepted(
          fullRequest.user,
          fullRequest.assignedProfessional,
          { id: fullRequest.id, categoryName: fullRequest.category?.name || 'el servicio', zoneName: fullRequest.geoNode?.name || 'tu zona' },
        ).catch((err) => {
          console.error('[RequestsService] Failed to notify user request accepted:', err);
        });
      }
    }

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
      request.userLatitude,
      request.userLongitude,
      request.problemType ?? undefined,
      request.isUrgent,
      request.mentionedDate,
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

  async cancelByUser(requestId: string): Promise<CancelByUserResult> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    const validStatuses = ['CREATED', 'ASSIGNED', 'ACCEPTED'];

    if (!validStatuses.includes(request.status)) {
      throw new AppError(
        `Cannot cancel a request with status ${request.status}. Expected CREATED, ASSIGNED, or ACCEPTED`,
        400,
      );
    }

    const coordinationStatus = request.coordinationStatus;
    const scheduledAt = request.scheduledAt;
    const hasConfirmedVisit = coordinationStatus === 'SCHEDULED' && !!scheduledAt;

    if (hasConfirmedVisit && scheduledAt) {
      const now = new Date();
      const hoursBeforeVisit =
        (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursBeforeVisit < 2) {
        throw new AppError(
          'Ya no es posible cancelar con menos de 2 horas de anticipación. Si tenés un problema, podés contactarnos.',
          400,
        );
      }
    }

    let shouldNotifyProfessional = false;
    let professionalMessage: string | null = null;

    if (hasConfirmedVisit && scheduledAt) {
      shouldNotifyProfessional = true;
      const formattedDate = formatDateTimeArgentina(scheduledAt);
      professionalMessage = `El usuario canceló la visita programada para el ${formattedDate}. Quedás disponible para nuevas asignaciones.`;
    } else if (
      request.status === 'ACCEPTED' &&
      request.assignedProfessionalId
    ) {
      shouldNotifyProfessional = true;
      professionalMessage =
        'El usuario canceló el pedido. Quedás disponible para nuevas asignaciones.';
    }

    let hoursBeforeVisit: number | null = null;

    if (hasConfirmedVisit && scheduledAt) {
      const now = new Date();
      hoursBeforeVisit =
        Math.round(
          ((scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60)) * 10,
        ) / 10;
    }

    const updated = await this.requestsRepository.update(requestId, {
      status: 'CANCELLED',
      assignmentTimeoutAt: null,
    });

    await this.requestsRepository.createEvent({
      requestId,
      professionalId: request.assignedProfessionalId,
      type: 'CANCELLED',
      metadata: {
        cancelledBy: 'USER',
        hadConfirmedVisit: hasConfirmedVisit,
        hoursBeforeVisit,
      },
    });

    let professionalPhone: string | null = null;

    if (shouldNotifyProfessional && request.assignedProfessionalId) {
      const pro = await prisma.professional.findUnique({
        where: { id: request.assignedProfessionalId },
        select: { phone: true },
      });
      professionalPhone = pro?.phone ?? null;
    }

    return {
      request: updated,
      shouldNotifyProfessional,
      professionalPhone,
      professionalMessage,
    };
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

  async finish(requestId: string): Promise<Request> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'ACCEPTED') {
      throw new AppError(
        `Cannot finish a request with status ${request.status}. Expected ACCEPTED`,
        400,
      );
    }

    if (!request.assignedProfessionalId) {
      throw new AppError('Request has no assigned professional', 400);
    }

    const updated = await this.requestsRepository.update(requestId, {
      status: 'PENDING_CONFIRMATION',
      completedAt: new Date(),
    });

    await this.requestsRepository.createEvent({
      requestId,
      professionalId: request.assignedProfessionalId,
      type: 'PENDING_CONFIRMATION',
    });

    return updated;
  }

  async confirm(
    requestId: string,
    satisfaction: Satisfaction,
    _comment?: string,
  ): Promise<Request> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'PENDING_CONFIRMATION') {
      throw new AppError(
        `Cannot confirm a request with status ${request.status}. Expected PENDING_CONFIRMATION`,
        400,
      );
    }

    if (!request.assignedProfessionalId) {
      throw new AppError('Request has no assigned professional', 400);
    }

    if (!['SATISFIED', 'PARTIAL', 'UNSATISFIED'].includes(satisfaction)) {
      throw new AppError(
        'satisfaction must be SATISFIED, PARTIAL, or UNSATISFIED',
        400,
      );
    }

    // SATISFIED, PARTIAL, and UNSATISFIED all mark as COMPLETED
    // Only UNSATISFIED creates an escalation for team review (no automatic penalization)
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

    const problemTypeRequest = await prisma.request.findUnique({
      where: { id: requestId },
      select: { problemType: true, assignedProfessionalId: true },
    });

    if (problemTypeRequest?.problemType && problemTypeRequest?.assignedProfessionalId) {
      const professional = await prisma.professional.findUnique({
        where: { id: problemTypeRequest.assignedProfessionalId },
        select: { problemTypeStats: true },
      });

      const stats = (professional?.problemTypeStats as Record<string, number>) || {};
      stats[problemTypeRequest.problemType] =
        (stats[problemTypeRequest.problemType] || 0) + 1;

      await prisma.professional.update({
        where: { id: problemTypeRequest.assignedProfessionalId },
        data: { problemTypeStats: stats },
      });
    }

    if (satisfaction === 'UNSATISFIED') {
      await this.escalationsService.create(
        requestId,
        request.userId,
        request.assignedProfessionalId,
      );
    }

    return updated;
  }

  async dispute(requestId: string, reason?: string): Promise<Request> {
    return this.confirm(requestId, 'UNSATISFIED', reason);
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

  async rateProfessional(
    requestId: string,
    data: {
      rating: number;
      punctualityRating: number;
      qualityRating: number;
      communicationRating: number;
      priceFairnessRating: number;
      wouldRecommend: boolean;
      userComment?: string;
    },
  ): Promise<Feedback> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'COMPLETED') {
      throw new AppError(
        `Cannot rate a request with status ${request.status}. Expected COMPLETED`,
        400,
      );
    }

    const validateRating = (field: string, value: number): void => {
      if (!Number.isFinite(value) || value < 1 || value > 5) {
        throw new AppError(`${field} must be between 1 and 5`, 400);
      }
    };

    validateRating('rating', data.rating);
    validateRating('punctualityRating', data.punctualityRating);
    validateRating('qualityRating', data.qualityRating);
    validateRating('communicationRating', data.communicationRating);
    validateRating('priceFairnessRating', data.priceFairnessRating);

    if (data.userComment && data.userComment.length > 300) {
      throw new AppError('userComment must not exceed 300 characters', 400);
    }

    const existing = await this.requestsRepository.findFeedbackByRequestId(requestId);

    if (existing?.ratedByUserAt) {
      throw new AppError('User has already rated this request', 409);
    }

    const calculatedRating = Math.round(
      (data.punctualityRating + data.qualityRating + data.communicationRating + data.priceFairnessRating) / 4,
    );

    return this.requestsRepository.upsertFeedback(requestId, {
      rating: calculatedRating,
      punctualityRating: data.punctualityRating,
      qualityRating: data.qualityRating,
      communicationRating: data.communicationRating,
      priceFairnessRating: data.priceFairnessRating,
      wouldRecommend: data.wouldRecommend,
      userComment: data.userComment,
      ratedByUserAt: new Date(),
    });
  }

  async rateUser(
    requestId: string,
    data: {
      requestClarityRating: number;
      userAvailabilityRating: number;
      userTreatmentRating: number;
      wouldServeAgain: boolean;
      professionalComment?: string;
    },
  ): Promise<Feedback> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'COMPLETED') {
      throw new AppError(
        `Cannot rate a request with status ${request.status}. Expected COMPLETED`,
        400,
      );
    }

    const validateRating = (field: string, value: number): void => {
      if (!Number.isFinite(value) || value < 1 || value > 5) {
        throw new AppError(`${field} must be between 1 and 5`, 400);
      }
    };

    validateRating('requestClarityRating', data.requestClarityRating);
    validateRating('userAvailabilityRating', data.userAvailabilityRating);
    validateRating('userTreatmentRating', data.userTreatmentRating);

    if (data.professionalComment && data.professionalComment.length > 300) {
      throw new AppError('professionalComment must not exceed 300 characters', 400);
    }

    const existing = await this.requestsRepository.findFeedbackByRequestId(requestId);

    if (existing?.ratedByProfessionalAt) {
      throw new AppError('Professional has already rated this request', 409);
    }

    return this.requestsRepository.upsertFeedback(requestId, {
      requestClarityRating: data.requestClarityRating,
      userAvailabilityRating: data.userAvailabilityRating,
      userTreatmentRating: data.userTreatmentRating,
      wouldServeAgain: data.wouldServeAgain,
      professionalComment: data.professionalComment,
      ratedByProfessionalAt: new Date(),
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

  async update(
    id: string,
    data: {
      status?: 'CREATED' | 'ASSIGNED' | 'ACCEPTED' | 'PENDING_CONFIRMATION' | 'CANCELLED' | 'NO_RESPONSE' | 'COMPLETED' | 'NOT_FULFILLED';
      waitingUserConsent?: boolean;
      waitingActivationSince?: Date | null;
      assignmentTimeoutAt?: Date | null;
    },
  ): Promise<Request> {
    return this.requestsRepository.update(id, data);
  }

  async processTimeouts(): Promise<number> {
    const now = new Date();
    let processed = 0;

    // 1. Process CREATED requests that expired (retry initial matching)
    const expiredCreated = await this.requestsRepository.findExpiredCreated(now);

    for (const request of expiredCreated) {
      try {
        const match = await this.matchingService.findBestCandidate(
          request.categoryId,
          request.geoNodeId,
          [],
          request.userLatitude,
          request.userLongitude,
          request.problemType ?? undefined,
          request.isUrgent,
          request.mentionedDate,
        );

        if (!match) {
          await this.requestsRepository.update(request.id, {
            status: 'NO_RESPONSE',
            assignmentTimeoutAt: null,
          });

          await this.requestsRepository.createEvent({
            requestId: request.id,
            type: 'NO_RESPONSE',
          });

          console.log(
            '[RequestsService] CREATED request moved to NO_RESPONSE (timeout, no candidates):',
            request.id,
          );
        } else {
          const responseTimeoutHours = await this.getResponseTimeoutHours();
          const assignmentTimeoutAt = new Date(
            now.getTime() + responseTimeoutHours * 60 * 60 * 1000,
          );

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

          await this.requestsRepository.updateLastAssignedAt(
            match.professionalId,
            now,
          );

          console.log(
            '[RequestsService] CREATED request assigned on timeout retry:',
            { requestId: request.id, professionalId: match.professionalId },
          );
        }

        processed++;
      } catch {
        // Continue processing remaining requests
      }
    }

    // Stage 1: Reminder (60-90 minutes without response)
    const nowMinus60 = new Date(now.getTime() - 60 * 60 * 1000);
    const nowMinus90 = new Date(now.getTime() - 90 * 60 * 1000);

    const reminderRequests = await this.matchingRepository.findRequestsForReminder(
      nowMinus60,
      nowMinus90,
    );

    for (const request of reminderRequests) {
      try {
        const phone = request.assignedProfessional?.phone;
        if (!phone) continue;

        const session = await this.botRepository.findByPhoneAndRole(phone, 'PROFESSIONAL');
        if (session?.reminderSentAt) continue;

        await this.botRepository.setReminderSent(phone, 'PROFESSIONAL', now);

        if (this.notificationService) {
          const categoryName = request.category?.name || 'el servicio';
          const zoneName = request.geoNode?.name || 'tu zona';

          await this.notificationService.notifyProfessionalReminder(
            { phone, name: request.assignedProfessional?.name || '' },
            { id: request.id, categoryName, zoneName },
          );
        } else {
          const message =
            'Tenés un pedido pendiente de respuesta. ¿Podés atenderlo? Entrá a tu panel para aceptarlo o rechazarlo.';
          console.log('[Timeout reminder] phone:', phone, 'message:', message);
        }

        processed++;
      } catch {
        // Continue processing remaining requests
      }
    }

    // Stage 2: Reassignment (> 90 minutes without response)
    const reassignRequests = await this.matchingRepository.findRequestsForReassignment(nowMinus90);

    for (const request of reassignRequests) {
      try {
        if (request.assignedProfessionalId) {
          await this.requestsRepository.createEvent({
            requestId: request.id,
            professionalId: request.assignedProfessionalId,
            type: 'NO_RESPONSE',
          });

          const pro = await prisma.professional.findUnique({
            where: { id: request.assignedProfessionalId },
            select: { phone: true },
          });

          if (pro?.phone) {
            await this.botRepository.clearReminderSent(pro.phone, 'PROFESSIONAL').catch(() => {
              // Ignore if session does not exist
            });
          }
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
          request.userLatitude,
          request.userLongitude,
          request.problemType ?? undefined,
          request.isUrgent,
          request.mentionedDate,
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

          // Notify user that no professional was found
          if (this.notificationService) {
            const userData = await prisma.user.findUnique({
              where: { id: request.userId },
              select: { phone: true, name: true },
            });
            if (userData?.phone) {
              this.notificationService.notifyUserNoResponse(userData).catch((err) => {
                console.error('[RequestsService] Failed to notify user no response:', err);
              });
            }
          }
        } else {
          const responseTimeoutHours = await this.getResponseTimeoutHours();
          const assignmentTimeoutAt = new Date(
            now.getTime() + responseTimeoutHours * 60 * 60 * 1000,
          );

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

          await this.requestsRepository.updateLastAssignedAt(
            match.professionalId,
            now,
          );

          // Notify new professional and user
          if (this.notificationService) {
            const categoryName = await this.getCategoryName(request.categoryId);
            const zoneName = await this.getZoneName(request.geoNodeId);

            const professional = await prisma.professional.findUnique({
              where: { id: match.professionalId },
              select: { phone: true, name: true },
            });

            if (professional) {
              this.notificationService.notifyProfessionalReassigned(
                professional,
                {
                  id: request.id,
                  categoryName,
                  zoneName,
                  description: request.description,
                  timeoutHours: responseTimeoutHours,
                  photoUrls: request.photoUrls ?? [],
                  audioUrl: request.audioUrl || undefined,
                  technicalBrief: request.technicalBrief,
                },
              ).catch((err) => {
                console.error('[RequestsService] Failed to notify professional reassigned:', err);
              });
            }
          }
        }

        processed++;
      } catch {
        // Continue processing remaining requests
      }
    }

    return processed;
  }

  async cancelByProfessional(
    requestId: string,
    professionalId: string,
  ): Promise<{
    request: Request;
    userPhone: string;
    userMessage: string;
    hadConfirmedVisit: boolean;
    scheduledAt: Date | null;
    professionalName: string;
    categoryName: string;
  }> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    const professionalName =
      ((request as unknown as Record<string, unknown>).assignedProfessional as Record<string, unknown>)?.name as string || 'El profesional';
    const categoryName =
      ((request as unknown as Record<string, unknown>).category as Record<string, unknown>)?.name as string || 'el servicio';

    if (request.status !== 'ACCEPTED') {
      throw new AppError(
        `Cannot cancel a request with status ${request.status}. Expected ACCEPTED`,
        400,
      );
    }

    if (request.assignedProfessionalId !== professionalId) {
      throw new AppError('Professional is not assigned to this request', 403);
    }

    const userPhone = (request as unknown as Record<string, unknown>).user as
      | { phone: string }
      | undefined;

    if (!userPhone?.phone) {
      throw new AppError('User phone not found', 500);
    }

    const hasConfirmedVisit =
      request.coordinationStatus === 'SCHEDULED' && !!request.scheduledAt;
    const scheduledAt = request.scheduledAt;

    await this.requestsRepository.update(requestId, {
      status: 'CANCELLED',
      assignmentTimeoutAt: null,
      scheduledAt: null,
      clientAddress: null,
      clientAvailability: null,
      coordinationStatus: null,
      negotiationRounds: 0,
    });

    await this.requestsRepository.createEvent({
      requestId,
      professionalId,
      type: 'CANCELLED',
      metadata: {
        cancelledBy: 'PROFESSIONAL',
        hadConfirmedVisit: hasConfirmedVisit,
        scheduledAt: scheduledAt?.toISOString() ?? null,
      },
    });

    const rejectorIds = await this.requestsRepository.findRejectorIds(requestId);
    const excludedIds = [...new Set([...rejectorIds, professionalId])];

    const match = await this.matchingService.findBestCandidate(
      request.categoryId,
      request.geoNodeId,
      excludedIds,
      request.userLatitude,
      request.userLongitude,
      request.problemType ?? undefined,
      request.isUrgent,
      request.mentionedDate,
    );

    let userMessage: string;

    if (hasConfirmedVisit && scheduledAt) {
      const formattedDate = formatDateTimeArgentina(scheduledAt);
      userMessage = `Lamentablemente el profesional canceló la visita programada para el ${formattedDate}. Estamos buscando otro profesional disponible.`;
    } else {
      userMessage =
        'Lamentablemente el profesional no puede atenderte en este momento. Estamos buscando otro profesional disponible para tu pedido.';
    }

    if (match) {
      const responseTimeoutHours = await this.getResponseTimeoutHours();
      const now = new Date();
      const assignmentTimeoutAt = new Date(
        now.getTime() + responseTimeoutHours * 60 * 60 * 1000,
      );

      await this.requestsRepository.update(requestId, {
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
    } else {
      userMessage =
        'No encontramos un profesional disponible en este momento. Te avisaremos cuando haya uno.';

      await this.requestsRepository.update(requestId, {
        status: 'NO_RESPONSE',
      });

      await this.requestsRepository.createEvent({
        requestId,
        type: 'NO_RESPONSE',
      });
    }

    const updated = await this.requestsRepository.findById(requestId);

    return {
      request: updated!,
      userPhone: userPhone.phone,
      userMessage,
      hadConfirmedVisit: hasConfirmedVisit,
      scheduledAt,
      professionalName,
      categoryName,
    };
  }

  async reassignAfterNegotiation(requestId: string, professionalId: string): Promise<Request | null> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'ACCEPTED') {
      throw new AppError(
        `Cannot reassign a request with status ${request.status}. Expected ACCEPTED`,
        400,
      );
    }

    const rejectorIds = await this.requestsRepository.findRejectorIds(requestId);
    const excludedIds = [...new Set([...rejectorIds, professionalId])];

    const match = await this.matchingService.findBestCandidate(
      request.categoryId,
      request.geoNodeId,
      excludedIds,
      request.userLatitude,
      request.userLongitude,
      request.problemType ?? undefined,
      request.isUrgent,
      request.mentionedDate,
    );

    if (!match) {
      const updated = await this.requestsRepository.update(requestId, {
        status: 'NO_RESPONSE',
        assignedProfessionalId: null,
        assignedAt: null,
        assignmentTimeoutAt: null,
        scheduledAt: null,
        clientAddress: null,
        clientAvailability: null,
        coordinationStatus: null,
        negotiationRounds: 0,
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
      scheduledAt: null,
      clientAddress: null,
      clientAvailability: null,
      coordinationStatus: null,
      negotiationRounds: 0,
    });

    await this.requestsRepository.createEvent({
      requestId,
      professionalId: match.professionalId,
      type: 'ASSIGNED',
    });

    await this.requestsRepository.updateLastAssignedAt(match.professionalId, now);

    return updated;
  }

  async confirmSchedule(
    requestId: string,
    scheduleText: string,
    proposedAt: string | null,
  ): Promise<Request> {
    const request = await this.requestsRepository.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.status !== 'ACCEPTED') {
      throw new AppError(
        `Cannot confirm schedule for a request with status ${request.status}. Expected ACCEPTED`,
        400,
      );
    }

    if (
      request.coordinationStatus !== 'AWAITING_CONFIRMATION' &&
      request.coordinationStatus !== 'AWAITING_USER_CONFIRMATION'
    ) {
      throw new AppError(
        `Cannot confirm schedule when coordination is ${request.coordinationStatus || 'not active'}`,
        400,
      );
    }

    if (proposedAt) {
      const parsedProposedAt = new Date(proposedAt);
      if (isNaN(parsedProposedAt.getTime())) {
        throw new AppError('proposedAt must be a valid ISO 8601 date', 400);
      }

      if (request.assignedProfessionalId) {
        const hasConflict = await this.requestsRepository.findConflictingSchedule(
          request.assignedProfessionalId,
          parsedProposedAt,
          requestId,
        );

        if (hasConflict) {
          throw new AppError(
            'Ya tenés una visita confirmada en ese día y hora. Proponé otro horario.',
            409,
          );
        }
      }

      await this.requestsRepository.update(requestId, {
        coordinationStatus: 'AWAITING_USER_CONFIRMATION',
        clientAvailability: scheduleText,
        scheduledAt: parsedProposedAt,
      });
    } else {
      const scheduledAt = parseExactDate(scheduleText);

      if (!scheduledAt) {
        await this.requestsRepository.update(requestId, {
          coordinationStatus: 'AWAITING_AVAILABILITY',
          clientAvailability: null,
        });

        throw new AppError(
          'El formato no es válido. Escribí así: DD/MM HH:MM (ejemplo: 20/06 16:00)',
          422,
        );
      }

      if (request.assignedProfessionalId) {
        const hasConflict = await this.requestsRepository.findConflictingSchedule(
          request.assignedProfessionalId,
          scheduledAt,
          requestId,
        );

        if (hasConflict) {
          throw new AppError(
            'Ya tenés una visita confirmada en ese día y hora. Proponé otro horario.',
            409,
          );
        }
      }

      await this.requestsRepository.update(requestId, {
        coordinationStatus: 'AWAITING_LOCATION',
        scheduledAt,
      });
    }

    return this.getById(requestId);
  }

  async autoClosePendingConfirmations(): Promise<number> {
    const autoCompleteHours = await this.getAutoCompleteHours();
    const cutoff = new Date(Date.now() - autoCompleteHours * 60 * 60 * 1000);
    const now = new Date();

    const pending = await this.requestsRepository.findPendingAutoClose(cutoff);
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
          metadata: {
            autoClosedAt: now.toISOString(),
            reason: 'timeout_user_confirmation',
          },
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

  private async getCategoryName(categoryId: string): Promise<string> {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { name: true },
    });
    return category?.name || 'el servicio';
  }

  private async getZoneName(geoNodeId: string): Promise<string> {
    const node = await prisma.geoNode.findUnique({
      where: { id: geoNodeId },
      select: { name: true },
    });
    return node?.name || 'tu zona';
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

  // --- Waiting activation flow ---

  async checkTrialExhaustedForWaiting(
    categoryId: string,
    geoNodeId: string,
  ): Promise<{ hasTrialExhausted: boolean; count: number }> {
    const trialLimit = await this.getTrialLimit();
    const exhausted =
      await this.matchingRepository.findTrialExhaustedProfessionals(
        categoryId,
        geoNodeId,
        trialLimit,
      );

    return {
      hasTrialExhausted: exhausted.length > 0,
      count: exhausted.length,
    };
  }

  async getTrialExhaustedProfessionals(
    categoryId: string,
    geoNodeId: string,
  ): Promise<{ id: string; name: string; phone: string }[]> {
    const trialLimit = await this.getTrialLimit();

    return this.matchingRepository.findTrialExhaustedProfessionals(
      categoryId,
      geoNodeId,
      trialLimit,
    );
  }

  async startWaitingForActivation(requestId: string): Promise<Request> {
    return this.requestsRepository.update(requestId, {
      waitingUserConsent: true,
      waitingActivationSince: new Date(),
    });
  }

  async closeWaitingRequest(requestId: string): Promise<Request> {
    return this.requestsRepository.update(requestId, {
      waitingUserConsent: false,
      waitingActivationSince: null,
    });
  }

  async checkWaitingActivations(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expired =
      await this.requestsRepository.findExpiredWaitingActivations(cutoff);

    for (const request of expired) {
      try {
        await this.requestsRepository.update(request.id, {
          waitingUserConsent: false,
          waitingActivationSince: null,
        });

        const userData = (request as unknown as { user?: { phone?: string; name?: string } }).user;

        if (userData?.phone) {
          console.log(
            `[RequestsService] 24h waiting activation expired: ${request.id}, user: ${userData.phone}`,
          );
        }
      } catch (err) {
        console.error(
          `[RequestsService] Error processing expired waiting activation ${request.id}:`,
          err,
        );
      }
    }

    return expired.length;
  }

  private async getTrialLimit(): Promise<number> {
    const config = await configRepository.findByKey('TRIAL_REQUESTS_LIMIT');

    if (config) {
      const parsed = parseInt(config.value, 10);

      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    return 3;
  }
}
