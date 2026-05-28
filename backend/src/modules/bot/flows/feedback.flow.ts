import { Prisma } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { BotRepository } from '../bot.repository';
import { CoordinationService } from '../coordination.service';
import { RequestsService, Satisfaction } from '../../requests/requests.service';
import { FlowContext, FlowHandler, FlowStepResult } from './types';
import { resolveOption } from './option-resolver.helper';

export class FeedbackFlow implements FlowHandler {
  readonly flowName = 'FEEDBACK';

  constructor(
    private readonly requestsService: RequestsService,
    private readonly botRepository: BotRepository,
    private readonly coordinationService: CoordinationService,
  ) {}

  getInitialStep(): string {
    return 'AWAITING_WORK_COMPLETION';
  }

  async handleStep(step: string, context: FlowContext): Promise<FlowStepResult> {
    const { session, message } = context;
    const tempData = (session.tempData as Record<string, unknown>) || {};
    const role = session.role as 'USER' | 'PROFESSIONAL';

    switch (step) {
      case 'AWAITING_WORK_COMPLETION':
        return this.handleAwaitingWorkCompletion(message, tempData, role);
      case 'FEEDBACK_SATISFACTION':
        return this.handleFeedbackSatisfaction(message, tempData, role);
      case 'FEEDBACK_RATING':
        return this.handleFeedbackRating(message, tempData, role);
      case 'FEEDBACK_RECOMMEND':
        return this.handleFeedbackRecommend(message, tempData, role);
      case 'FEEDBACK_COMMENT':
        return this.handleFeedbackComment(message, tempData, role);
      case 'FEEDBACK_PRO_RATING':
        return this.handleFeedbackProfessionalRating(message, tempData, role);
      case 'FEEDBACK_PRO_RECOMMEND':
        return this.handleFeedbackProfessionalRecommend(message, tempData, role);
      default:
        return this.handleAwaitingWorkCompletion(message, tempData, role);
    }
  }

  private async handleAwaitingWorkCompletion(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'PROFESSIONAL') {
      return {
        response: { text: 'Estamos esperando la confirmación del profesional.' },
        nextStep: 'AWAITING_WORK_COMPLETION',
        tempData,
      };
    }

    const requestId = tempData.requestId as string | undefined;
    if (!requestId) {
      return {
        response: { text: 'No encontré el pedido para confirmar finalización.' },
        nextStep: null,
        tempData: {},
      };
    }

    const inputText = message.text?.trim().toLowerCase() || '';
    const resolved = resolveOption('AWAITING_WORK_COMPLETION', inputText);

    if (resolved === 'DONE') {
      try {
        await this.requestsService.confirmCompletion(requestId, true);
        await this.coordinationService.notifyWorkFinished(requestId);

        return {
          response: {
            text: 'Perfecto. Marcamos el trabajo como finalizado y le pedimos feedback al usuario.',
          },
          nextStep: null,
          tempData: {},
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'No pude confirmar la finalización del trabajo.';

        return {
          response: { text: errorMessage },
          nextStep: 'AWAITING_WORK_COMPLETION',
          tempData,
        };
      }
    }

    if (resolved === 'PENDING') {
      return {
        response: {
          text: 'Entendido. Lo dejamos pendiente y te volvemos a consultar más adelante.',
        },
        nextStep: 'AWAITING_WORK_COMPLETION',
        tempData: {
          ...tempData,
          completionLastCheckAt: new Date().toISOString(),
        },
      };
    }

    return {
      response: {
        text: 'No entendí tu respuesta.\n1. Finalicé\n2. Pendiente',
      },
      nextStep: 'AWAITING_WORK_COMPLETION',
      tempData,
    };
  }

  private async handleFeedbackSatisfaction(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'USER') {
      return {
        response: { text: 'Estamos esperando la respuesta del usuario.' },
        nextStep: 'FEEDBACK_SATISFACTION',
        tempData,
      };
    }

    const requestId = tempData.requestId as string | undefined;
    if (!requestId) {
      return {
        response: { text: 'No encontré el pedido a calificar.' },
        nextStep: null,
        tempData: {},
      };
    }

    const inputText = message.text?.trim().toLowerCase() || '';
    const resolved = resolveOption('FEEDBACK_SATISFACTION', inputText);

    if (!resolved) {
      return {
        response: {
          text: 'Respondé:\n1. Conforme\n2. Con observaciones\n3. No conforme',
        },
        nextStep: 'FEEDBACK_SATISFACTION',
        tempData,
      };
    }

    if (resolved === 'UNSATISFIED') {
      await this.handleUnsatisfiedFeedback(requestId);

      return {
        response: {
          text: 'Gracias por contarnos. Abrimos una escalada para que el equipo revise tu caso.',
        },
        nextStep: null,
        tempData: {},
      };
    }

    const satisfaction: Satisfaction = resolved === 'PARTIAL' ? 'PARTIAL' : 'SATISFIED';

    await this.tryConfirmSatisfaction(requestId, satisfaction);

    return {
      response: {
        text: 'Gracias. Del 1 al 5, ¿qué puntaje le das al profesional?',
      },
      nextStep: 'FEEDBACK_RATING',
      tempData,
    };
  }

  private async handleFeedbackRating(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'USER') {
      return {
        response: { text: 'Estamos esperando la calificación del usuario.' },
        nextStep: 'FEEDBACK_RATING',
        tempData,
      };
    }

    const rating = this.parseRating(message.text);
    if (!rating) {
      return {
        response: {
          text: 'Ingresá una calificación válida del 1 al 5.',
        },
        nextStep: 'FEEDBACK_RATING',
        tempData,
      };
    }

    return {
      response: {
          text: '¿Lo recomendarías?\n1. Sí\n2. No',
      },
      nextStep: 'FEEDBACK_RECOMMEND',
      tempData: {
        ...tempData,
        userRating: rating,
      },
    };
  }

  private async handleFeedbackRecommend(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'USER') {
      return {
        response: { text: 'Estamos esperando la recomendación del usuario.' },
        nextStep: 'FEEDBACK_RECOMMEND',
        tempData,
      };
    }

    const inputText = message.text?.trim().toLowerCase() || '';
    const resolved = resolveOption('FEEDBACK_RECOMMEND', inputText);

    if (!resolved) {
      return {
        response: { text: '1. Sí\n2. No' },
        nextStep: 'FEEDBACK_RECOMMEND',
        tempData,
      };
    }

    return {
      response: {
        text: '¿Querés dejar algún comentario? Escribilo o respondé "omitir".',
      },
      nextStep: 'FEEDBACK_COMMENT',
      tempData: {
        ...tempData,
        userWouldRecommend: resolved === 'YES',
      },
    };
  }

  private async handleFeedbackComment(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'USER') {
      return {
        response: { text: 'Estamos esperando el comentario del usuario.' },
        nextStep: 'FEEDBACK_COMMENT',
        tempData,
      };
    }

    const requestId = tempData.requestId as string | undefined;
    const rating = Number(tempData.userRating);
    const wouldRecommend = Boolean(tempData.userWouldRecommend);

    if (!requestId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      return {
        response: { text: 'No pude registrar la calificación. Volvé a intentarlo.' },
        nextStep: null,
        tempData: {},
      };
    }

    const rawComment = message.text?.trim() || '';
    const userComment = rawComment && rawComment.toLowerCase() !== 'omitir' ? rawComment : undefined;

    try {
      await this.requestsService.rateProfessional(requestId, {
        rating,
        punctualityRating: rating,
        qualityRating: rating,
        communicationRating: rating,
        priceFairnessRating: rating,
        wouldRecommend,
        userComment,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No pude guardar tu calificación.';
      return {
        response: { text: errorMessage },
        nextStep: null,
        tempData: {},
      };
    }

    const professionalPhoneFromTemp = tempData.professionalPhone as string | undefined;
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        assignedProfessional: { select: { phone: true, name: true } },
      },
    });

    const professionalPhone = professionalPhoneFromTemp || request?.assignedProfessional?.phone;

    if (professionalPhone) {
      await this.coordinationService.sendMessageWithWindowCheck(
        professionalPhone,
        'PROFESSIONAL',
        'El usuario ya calificó el trabajo. Del 1 al 5, ¿cómo evaluás al usuario?',
        'nora_pro_pedir_calificacion_usuario',
        [],
      );

      await this.botRepository.upsert(professionalPhone, {
        role: 'PROFESSIONAL',
        currentFlow: 'FEEDBACK',
        currentStep: 'FEEDBACK_PRO_RATING',
        tempData: {
          requestId,
          professionalPhone,
          professionalName: request?.assignedProfessional?.name,
          userPhone: tempData.userPhone,
          userName: tempData.userName,
        } as Prisma.InputJsonValue,
      });
    }

    return {
      response: {
        text: '¡Gracias! Tu calificación fue registrada.',
      },
      nextStep: null,
      tempData: {},
    };
  }

  private async handleFeedbackProfessionalRating(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'PROFESSIONAL') {
      return {
        response: { text: 'Estamos esperando la calificación del profesional.' },
        nextStep: 'FEEDBACK_PRO_RATING',
        tempData,
      };
    }

    const rating = this.parseRating(message.text);
    if (!rating) {
      return {
        response: {
          text: 'Ingresá una calificación válida del 1 al 5.',
        },
        nextStep: 'FEEDBACK_PRO_RATING',
        tempData,
      };
    }

    return {
      response: {
        text: '¿Volvería a atenderlo?\n1. Sí\n2. No',
      },
      nextStep: 'FEEDBACK_PRO_RECOMMEND',
      tempData: {
        ...tempData,
        professionalRating: rating,
      },
    };
  }

  private async handleFeedbackProfessionalRecommend(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'PROFESSIONAL') {
      return {
        response: { text: 'Estamos esperando la respuesta del profesional.' },
        nextStep: 'FEEDBACK_PRO_RECOMMEND',
        tempData,
      };
    }

    const requestId = tempData.requestId as string | undefined;
    const rating = Number(tempData.professionalRating);

    if (!requestId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      return {
        response: { text: 'No pude registrar la calificación. Volvé a intentarlo.' },
        nextStep: null,
        tempData: {},
      };
    }

    const inputText = message.text?.trim().toLowerCase() || '';
    const resolved = resolveOption('FEEDBACK_PRO_RECOMMEND', inputText);

    if (!resolved) {
      return {
        response: { text: '1. Sí\n2. No' },
        nextStep: 'FEEDBACK_PRO_RECOMMEND',
        tempData,
      };
    }

    try {
      await this.requestsService.rateUser(requestId, {
        requestClarityRating: rating,
        userAvailabilityRating: rating,
        userTreatmentRating: rating,
        wouldServeAgain: resolved === 'YES',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No pude guardar tu calificación.';
      return {
        response: { text: errorMessage },
        nextStep: null,
        tempData: {},
      };
    }

    return {
      response: {
        text: '¡Gracias! Tu calificación fue registrada.',
      },
      nextStep: null,
      tempData: {},
    };
  }

  private parseRating(value?: string): number | null {
    if (!value) return null;
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
      return null;
    }

    return parsed;
  }

  private async tryConfirmSatisfaction(requestId: string, satisfaction: Satisfaction): Promise<void> {
    try {
      await this.requestsService.confirm(requestId, satisfaction);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Expected PENDING_CONFIRMATION')) {
        throw error;
      }
    }
  }

  private async handleUnsatisfiedFeedback(requestId: string): Promise<void> {
    try {
      await this.requestsService.confirm(requestId, 'UNSATISFIED');
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Expected PENDING_CONFIRMATION')) {
        throw error;
      }
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, userId: true, assignedProfessionalId: true },
    });

    if (!request?.assignedProfessionalId) {
      return;
    }

    const existingEscalation = await prisma.escalation.findUnique({
      where: { requestId: request.id },
      select: { id: true },
    });

    if (!existingEscalation) {
      await prisma.escalation.create({
        data: {
          requestId: request.id,
          reportedBy: request.userId,
          professionalId: request.assignedProfessionalId,
          status: 'OPEN',
        },
      });
    }
  }
}
