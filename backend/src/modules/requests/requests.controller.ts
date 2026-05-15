import { Request, Response, NextFunction } from 'express';
import { RequestsService, Satisfaction } from './requests.service';
import { RequestsRepository } from './requests.repository';
import { MatchingRepository } from '../matching/matching.repository';
import { UsersRepository } from '../users/users.repository';
import { CoordinationService } from '../bot/coordination.service';
import { BotRepository } from '../bot/bot.repository';
import { WhatsAppAdapter } from '../../lib/whatsapp-adapter';
import { R2Client } from '../../lib/r2-client';
import { NotificationService } from '../notifications/notification.service';
import { formatDateTimeArgentina } from '../../utils/date-utils';

const requestsRepository = new RequestsRepository();
const usersRepository = new UsersRepository();
const matchingRepository = new MatchingRepository();
const botRepository = new BotRepository();
const r2Client = new R2Client();
const whatsappAdapter = new WhatsAppAdapter(r2Client, botRepository);
const notificationService = new NotificationService(whatsappAdapter);
const coordinationService = new CoordinationService(botRepository, whatsappAdapter);
const requestsService = new RequestsService(
  requestsRepository,
  usersRepository,
  matchingRepository,
  botRepository,
  undefined,
  undefined,
  notificationService,
  coordinationService,
);

type ReassignmentReason = 'PROFESSIONAL_CANCELLED' | 'TIMEOUT';

interface ReassignmentInfo {
  reassignmentCount: number;
  lastReassignmentReason: ReassignmentReason | null;
}

interface RequestEventLike {
  type: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

function computeReassignmentInfo(events: RequestEventLike[]): ReassignmentInfo {
  const sorted = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const assignedEvents = sorted.filter((e) => e.type === 'ASSIGNED');

  if (assignedEvents.length === 0) {
    return { reassignmentCount: 0, lastReassignmentReason: null };
  }

  const reassignmentCount = Math.max(0, assignedEvents.length - 1);

  if (reassignmentCount === 0) {
    return { reassignmentCount: 0, lastReassignmentReason: null };
  }

  let lastAssignedIndex = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].type === 'ASSIGNED') {
      lastAssignedIndex = i;
      break;
    }
  }

  let prevEvent: RequestEventLike | undefined;
  for (let i = lastAssignedIndex - 1; i >= 0; i--) {
    if (sorted[i].type !== 'ASSIGNED') {
      prevEvent = sorted[i];
      break;
    }
  }

  if (!prevEvent) {
    return { reassignmentCount, lastReassignmentReason: null };
  }

  if (prevEvent.type === 'CANCELLED') {
    const cancelledBy = prevEvent.metadata?.cancelledBy;
    if (cancelledBy === 'PROFESSIONAL') {
      return { reassignmentCount, lastReassignmentReason: 'PROFESSIONAL_CANCELLED' };
    }
  }

  if (prevEvent.type === 'NO_RESPONSE') {
    return { reassignmentCount, lastReassignmentReason: 'TIMEOUT' };
  }

  return { reassignmentCount, lastReassignmentReason: null };
}

export class RequestsController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, categoryId, geoNodeId, description, photoUrls, audioUrl } =
        req.body as {
          phone?: string;
          categoryId?: string;
          geoNodeId?: string;
          description?: string;
          photoUrls?: string[];
          audioUrl?: string;
        };

      if (!phone) {
        res.status(400).json({ error: 'Phone is required', statusCode: 400 });
        return;
      }

      if (!categoryId) {
        res.status(400).json({ error: 'Category is required', statusCode: 400 });
        return;
      }

      if (!geoNodeId) {
        res.status(400).json({ error: 'Geo node is required', statusCode: 400 });
        return;
      }

      if (!description) {
        res.status(400).json({ error: 'Description is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.create({
        phone,
        categoryId,
        geoNodeId,
        description,
        photoUrls,
        audioUrl,
      });

      res.status(201).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async accept(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.accept(id);

      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.reject(id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.cancel(id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async markCompleted(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.markCompleted(id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async finish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.finish(id);

      try {
        await coordinationService.notifyWorkFinished(id);
      } catch (err) {
        console.error('[RequestsController] Failed to notify work finished:', err);
      }

      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { satisfaction, comment } = req.body as {
        satisfaction?: string;
        comment?: string;
      };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (!satisfaction) {
        res.status(400).json({ error: 'satisfaction is required', statusCode: 400 });
        return;
      }

      if (!['SATISFIED', 'PARTIAL', 'UNSATISFIED'].includes(satisfaction)) {
        res.status(400).json({
          error: 'satisfaction must be SATISFIED, PARTIAL, or UNSATISFIED',
          statusCode: 400,
        });
        return;
      }

      const request = await requestsService.confirm(
        id,
        satisfaction as Satisfaction,
        comment,
      );
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async dispute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body as { reason?: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.dispute(id, reason);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async confirmCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { fulfilled } = req.body as { fulfilled?: boolean };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (fulfilled === undefined) {
        res.status(400).json({ error: 'Fulfilled is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.confirmCompletion(id, fulfilled);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async reportNoncompliance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.reportNoncompliance(id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { workCompleted, wouldRecommend, comment } = req.body as {
        workCompleted?: boolean;
        wouldRecommend?: boolean;
        comment?: string;
      };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (workCompleted === undefined) {
        res.status(400).json({ error: 'workCompleted is required', statusCode: 400 });
        return;
      }

      if (wouldRecommend === undefined) {
        res.status(400).json({ error: 'wouldRecommend is required', statusCode: 400 });
        return;
      }

      const feedback = await requestsService.submitFeedback(
        id,
        workCompleted,
        wouldRecommend,
        comment,
      );

      res.status(201).json({ data: feedback });
    } catch (err) {
      next(err);
    }
  }

  async rateProfessional(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const {
        rating,
        punctualityRating,
        qualityRating,
        communicationRating,
        priceFairnessRating,
        wouldRecommend,
        userComment,
      } = req.body as {
        rating?: number;
        punctualityRating?: number;
        qualityRating?: number;
        communicationRating?: number;
        priceFairnessRating?: number;
        wouldRecommend?: boolean;
        userComment?: string;
      };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (rating === undefined) {
        res.status(400).json({ error: 'rating is required', statusCode: 400 });
        return;
      }

      if (punctualityRating === undefined) {
        res.status(400).json({ error: 'punctualityRating is required', statusCode: 400 });
        return;
      }

      if (qualityRating === undefined) {
        res.status(400).json({ error: 'qualityRating is required', statusCode: 400 });
        return;
      }

      if (communicationRating === undefined) {
        res.status(400).json({ error: 'communicationRating is required', statusCode: 400 });
        return;
      }

      if (priceFairnessRating === undefined) {
        res.status(400).json({ error: 'priceFairnessRating is required', statusCode: 400 });
        return;
      }

      if (wouldRecommend === undefined) {
        res.status(400).json({ error: 'wouldRecommend is required', statusCode: 400 });
        return;
      }

      const feedback = await requestsService.rateProfessional(id, {
        rating,
        punctualityRating,
        qualityRating,
        communicationRating,
        priceFairnessRating,
        wouldRecommend,
        userComment,
      });

      res.status(201).json({ data: feedback });
    } catch (err) {
      next(err);
    }
  }

  async rateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const {
        requestClarityRating,
        userAvailabilityRating,
        userTreatmentRating,
        wouldServeAgain,
        professionalComment,
      } = req.body as {
        requestClarityRating?: number;
        userAvailabilityRating?: number;
        userTreatmentRating?: number;
        wouldServeAgain?: boolean;
        professionalComment?: string;
      };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (requestClarityRating === undefined) {
        res.status(400).json({ error: 'requestClarityRating is required', statusCode: 400 });
        return;
      }

      if (userAvailabilityRating === undefined) {
        res.status(400).json({ error: 'userAvailabilityRating is required', statusCode: 400 });
        return;
      }

      if (userTreatmentRating === undefined) {
        res.status(400).json({ error: 'userTreatmentRating is required', statusCode: 400 });
        return;
      }

      if (wouldServeAgain === undefined) {
        res.status(400).json({ error: 'wouldServeAgain is required', statusCode: 400 });
        return;
      }

      const feedback = await requestsService.rateUser(id, {
        requestClarityRating,
        userAvailabilityRating,
        userTreatmentRating,
        wouldServeAgain,
        professionalComment,
      });

      res.status(201).json({ data: feedback });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = req.query as { page?: string; limit?: string };

      const result = await requestsService.list(
        page ? parseInt(page, 10) : undefined,
        limit ? parseInt(limit, 10) : undefined,
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.getById(id);

      const response: Record<string, unknown> = { ...request as Record<string, unknown> };

      const events = (request as Record<string, unknown>).events as
        | Array<{ type: string; createdAt: string; metadata?: Record<string, unknown> | null }>
        | undefined;

      if (events) {
        const { reassignmentCount, lastReassignmentReason } =
          computeReassignmentInfo(events);

        response.reassignmentCount = reassignmentCount;
        response.lastReassignmentReason = lastReassignmentReason;
      } else {
        response.reassignmentCount = 0;
        response.lastReassignmentReason = null;
      }

      if (request.coordinationStatus && request.coordinationStatus !== 'SCHEDULED') {
        response.coordination = {
          status: request.coordinationStatus,
          scheduledAt: request.scheduledAt,
          clientAvailability: request.clientAvailability,
          clientAddress: request.clientAddress,
          hasLocation: !!(request.clientLatitude && request.clientLongitude),
        };
      }

      res.status(200).json({ data: response });
    } catch (err) {
      next(err);
    }
  }

  async confirmVisit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { scheduleText } = req.body as { scheduleText?: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (!scheduleText || !scheduleText.trim()) {
        res.status(400).json({ error: 'scheduleText is required', statusCode: 400 });
        return;
      }

      await coordinationService.confirmVisit(id, scheduleText.trim());
      const request = await requestsService.getById(id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async cancelByProfessional(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { professionalId } = req.body as { professionalId?: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (!professionalId) {
        res.status(400).json({
          error: 'professionalId is required',
          statusCode: 400,
        });
        return;
      }

      const result = await requestsService.cancelByProfessional(id, professionalId);

      try {
        await whatsappAdapter.sendText(result.userPhone, result.userMessage, 'USER');
      } catch (err) {
        console.error(
          '[RequestsController] Failed to notify user about professional cancellation:',
          err,
        );
      }

      res.status(200).json({ data: result.request });
    } catch (err) {
      next(err);
    }
  }

  async confirmSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { scheduleText, proposedAt } = req.body as {
        scheduleText?: string;
        proposedAt?: string;
      };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (!scheduleText || !scheduleText.trim()) {
        res.status(400).json({ error: 'scheduleText is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.confirmSchedule(
        id,
        scheduleText.trim(),
        proposedAt || null,
      );

      if (request.coordinationStatus === 'AWAITING_USER_CONFIRMATION' && proposedAt) {
        try {
          const user = (request as unknown as Record<string, unknown>).user as
            | { phone: string }
            | undefined;
          const professional = (request as unknown as Record<string, unknown>).assignedProfessional as
            | { name: string; phone: string }
            | undefined;

          if (user?.phone) {
            const professionalName = professional?.name || 'El profesional';
            const alternativeText = formatDateTimeArgentina(new Date(proposedAt));
            const userMessage = `${professionalName} propone el ${alternativeText}. ¿Te viene bien? (Sí / No)`;

            const userSession = await botRepository.findByPhoneAndRole(user.phone, 'USER');
            const userTempData = (userSession?.tempData as Record<string, unknown>) || {};

            await botRepository.upsert(user.phone, {
              role: 'USER',
              currentFlow: 'COORDINATION',
              currentStep: 'AWAITING_USER_CONFIRMATION',
              tempData: {
                ...userTempData,
                requestId: id,
                alternativeScheduledAt: new Date(proposedAt).toISOString(),
                professionalName,
                professionalPhone: professional?.phone,
                pendingMessage: userMessage,
              },
            });
          }
        } catch (err) {
          console.error('[RequestsController.confirmSchedule] Failed to notify user:', err);
        }
      }

      res.status(200).json({ data: request });
    } catch (err) {
      const appErr = err as { statusCode?: number; message?: string };

      if (appErr.statusCode === 409) {
        res.status(409).json({
          error: appErr.message || 'Ya tenés una visita confirmada en ese día y hora. Proponé otro horario.',
          statusCode: 409,
        });
        return;
      }

      next(err);
    }
  }
}

export const requestsController = new RequestsController();
