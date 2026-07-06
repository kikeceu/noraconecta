import { Prisma } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { callLLM } from '../../../lib/llm-client';
import { BotRepository } from '../bot.repository';
import { CoordinationService } from '../coordination.service';
import { RequestsService, Satisfaction } from '../../requests/requests.service';
import { NotificationService } from '../../notifications/notification.service';
import { FlowContext, FlowHandler, FlowStepResult } from './types';
import { resolveOption, resolveOptionWithFallback, generateOffTopicResponse } from './option-resolver.helper';
import { promptService } from '../../prompts/prompt.service';

export class FeedbackFlow implements FlowHandler {
  readonly flowName = 'FEEDBACK';

  constructor(
    private readonly requestsService: RequestsService,
    private readonly botRepository: BotRepository,
    private readonly coordinationService: CoordinationService,
    private readonly notificationService: NotificationService,
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
      case 'FEEDBACK_RATING':
        return this.handleFeedbackRating(message, tempData, role);
      case 'FEEDBACK_RECOMMEND':
        return this.handleFeedbackRecommend(message, tempData, role);
      case 'FEEDBACK_AMOUNT':
        return this.handleFeedbackAmount(message, tempData, role);
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
        tempData: { _clearTempData: true },
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
          tempData: { _clearTempData: true },
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
      const completionAttempt = tempData.completionAttempt as number || 0;

      if (completionAttempt >= 2) {
        try {
          await this.requestsService.reportNoncompliance(requestId);
        } catch {
          // ignore if already exists
        }

        return {
          response: { text: 'Entendido. Derivamos el caso a nuestro equipo para revisarlo.' },
          nextStep: null,
          tempData: { _clearTempData: true },
        };
      }

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

    const requestId = tempData.requestId as string | undefined;
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

    const satisfaction = this.deriveSatisfaction(rating);

    if (requestId) {
      await this.tryConfirmSatisfaction(requestId, satisfaction);
    }

    if (satisfaction === 'UNSATISFIED' && requestId) {
      await this.handleUnsatisfiedFeedback(requestId);
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
    const resolved = await resolveOptionWithFallback('FEEDBACK_RECOMMEND', inputText);

    if (!resolved) {
      const stepContext = `Se le preguntó al usuario si recomendaría al profesional. Opciones: 1. Sí, 2. No.`;
      const offTopic = await generateOffTopicResponse(inputText, stepContext);
      if (offTopic) {
        return {
          response: { text: offTopic },
          nextStep: 'FEEDBACK_RECOMMEND',
          tempData,
        };
      }

      return {
        response: { text: '1. Sí\n2. No' },
        nextStep: 'FEEDBACK_RECOMMEND',
        tempData,
      };
    }

    const wouldRecommend = resolved === 'YES';
    const rating = Number(tempData.userRating);

    const requestId = tempData.requestId as string | undefined;
    if (requestId) {
      const request = await prisma.request.findUnique({
        where: { id: requestId },
        include: {
          assignedProfessional: { select: { phone: true, name: true } },
        },
      });

      const professionalPhone = (tempData.professionalPhone as string | undefined) || request?.assignedProfessional?.phone;
      const userName = (tempData.userName as string) || 'el usuario';

      if (professionalPhone) {
        let proMessage = `El usuario ya calificó el trabajo. ¿Cómo evaluás a ${userName} del 1 al 5?`;
        let templateName = 'nora_pro_pedir_calificacion_usuario';
        let templateParams = [userName];

        if (wouldRecommend && rating >= 4) {
          const professionalName = request?.assignedProfessional?.name || 'Profesional';
          try {
            const motivationText = await this.notificationService.notifyProfessionalPositiveFeedback(
              professionalPhone,
              professionalName,
              userName,
            );
            proMessage = `${motivationText}\n\n¿Cómo evaluás a ${userName} del 1 al 5?`;
            templateName = 'nora_pro_felicitacion_calificacion';
            templateParams = [professionalName, userName];
          } catch (err) {
            console.error('[FeedbackFlow] Failed to build positive feedback notification:', err);
          }
        }

        try {
          await this.coordinationService.sendMessageWithWindowCheck(
            professionalPhone,
            'PROFESSIONAL',
            proMessage,
            templateName,
            templateParams,
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
        } catch (err) {
          console.error('[FeedbackFlow] Failed to notify professional for rating:', err);
        }
      }
    }

    return {
      response: {
        text: `${wouldRecommend ? 'Gracias por tu recomendación.' : 'Gracias por tu opinión.'}\n\nPara ayudar a otros vecinos a saber qué esperar, ¿cuánto pagaste por este trabajo? Escribí solo el monto (ej: 5000) o "no sé" para saltearlo.`,
      },
      nextStep: 'FEEDBACK_AMOUNT',
      tempData: {
        ...tempData,
        userWouldRecommend: wouldRecommend,
      },
    };
  }

  private async handleFeedbackAmount(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'USER') {
      return {
        response: { text: 'Estamos esperando la respuesta del usuario.' },
        nextStep: 'FEEDBACK_AMOUNT',
        tempData,
      };
    }

    const requestId = tempData.requestId as string | undefined;
    const inputText = message.text?.trim() || '';

    // Clean dots, commas and spaces before parsing
    const cleanedInput = inputText.replace(/[.$,\s]/g, '');
    const amount = parseInt(cleanedInput, 10);

    if (requestId && !isNaN(amount) && amount > 0) {
      try {
        await prisma.requestPricing.upsert({
          where: { requestId },
          create: {
            requestId,
            amountPaid: amount,
            currency: 'ARS',
            reportedAt: new Date(),
          },
          update: {
            amountPaid: amount,
            reportedAt: new Date(),
          },
        });
      } catch {
        // Silently ignore — pricing capture must never block the flow
      }
    }

    return {
      response: {
        text: '¿Querés dejar algún comentario sobre el trabajo? Escribí lo que quieras o "no" para terminar.',
      },
      nextStep: 'FEEDBACK_COMMENT',
      tempData,
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
    const userComment = rawComment && rawComment.toLowerCase() !== 'no' ? rawComment : undefined;

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
        tempData: { _clearTempData: true },
      };
    }

    if (userComment) {
      void this.analyzeSentiment(requestId, userComment).catch((err) => {
        console.error('[FeedbackFlow] sentiment analysis failed:', err);
      });
    }

    return {
      response: {
        text: '¡Gracias! Tu calificación fue registrada.',
      },
      nextStep: null,
      tempData: { _clearTempData: true },
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
        tempData: { _clearTempData: true },
      };
    }

    const inputText = message.text?.trim().toLowerCase() || '';
    const resolved = await resolveOptionWithFallback('FEEDBACK_PRO_RECOMMEND', inputText);

    if (!resolved) {
      const stepContext = `Se le preguntó al profesional si volvería a atender al usuario. Opciones: 1. Sí, 2. No.`;
      const offTopic = await generateOffTopicResponse(inputText, stepContext);
      if (offTopic) {
        return {
          response: { text: offTopic },
          nextStep: 'FEEDBACK_PRO_RECOMMEND',
          tempData,
        };
      }

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
        tempData: { _clearTempData: true },
      };
    }

    return {
      response: {
        text: '¡Gracias! Tu calificación fue registrada.',
      },
      nextStep: null,
      tempData: { _clearTempData: true },
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

  private deriveSatisfaction(rating: number): Satisfaction {
    if (rating <= 2) return 'UNSATISFIED';
    if (rating === 3) return 'PARTIAL';
    return 'SATISFIED';
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

  private async analyzeSentiment(requestId: string, comment: string): Promise<void> {
    const prompt = await promptService.getPrompt('analyze_feedback', { comment });

    try {
      const text = await callLLM(prompt);
      const analysis = JSON.parse(text) as Record<string, number | boolean | null>;
      await prisma.feedback.update({
        where: { requestId },
        data: { sentimentAnalysis: analysis },
      });
    } catch {
      // ignore if fails — background task
    }
  }
}
