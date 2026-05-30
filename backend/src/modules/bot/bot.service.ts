import { BotRepository } from './bot.repository';
import { resolveFlowHandler, getFlowHandlerByName } from './flows/flow-handler.factory';
import { FlowContext, BotResponse, LocationData, PendingNotification } from './flows/types';
import { isCancellationIntent } from './flows/cancel-flow.helper';
import { UsersService } from '../users/users.service';
import { RequestsRepository } from '../requests/requests.repository';
import { ProfessionalsRepository } from '../professionals/professionals.repository';
import prisma from '../../lib/prisma';
import { Prisma, BotRole, ProfessionalStatus } from '@prisma/client';

export type ProcessMessageInput = {
  phone: string;
  text?: string;
  imageUrls?: string[];
  audioUrl?: string;
  location?: LocationData;
  role?: BotRole;
};

export class BotService {
  constructor(
    private readonly botRepository: BotRepository,
    private readonly usersService: UsersService,
    private readonly requestsRepository: RequestsRepository,
    private readonly professionalsRepository: ProfessionalsRepository,
  ) {}

  async processMessage(
    input: ProcessMessageInput,
  ): Promise<BotResponse & { flow?: string; step?: string; pendingNotification?: PendingNotification }> {
    const role: BotRole = input.role || 'USER';
    const user =
      role === 'USER'
        ? await this.usersService.findOrCreateByPhone(input.phone)
        : (await this.usersService.findByPhone(input.phone)) ?? { id: '', name: '', phone: input.phone };

    const userIdentity = {
      userId: user.id,
      name: user.name,
      phone: user.phone,
    };

    if (role === 'USER' && (user as { status: string }).status === 'BLOCKED') {
      return {
        text: 'Tu cuenta está suspendida temporalmente por uso irregular. Si creés que es un error, escribinos a soporte@noraconecta.com',
        flow: undefined,
        step: undefined,
      };
    }

    if (role === 'PROFESSIONAL') {
      const professional = await this.professionalsRepository.findByPhone(input.phone);
      if (professional?.status === 'SUSPENDED') {
        return {
          text: 'Tu cuenta está suspendida temporalmente por uso irregular. Si creés que es un error, escribinos a soporte@noraconecta.com',
          flow: undefined,
          step: undefined,
        };
      }
    }

    let session = await this.botRepository.findByPhoneAndRole(input.phone, role);

    console.log('[processMessage] phone:', input.phone, 'role:', role, 'currentFlow:', session?.currentFlow, 'currentStep:', session?.currentStep);

    let observationWarning: string | undefined;

    if (
      role === 'PROFESSIONAL' &&
      session?.currentFlow === 'PROFESSIONAL_REGISTER'
    ) {
      const existingProfessional = await this.professionalsRepository.findByPhone(input.phone);

      if (existingProfessional) {
        const state = await this.resolveProfessionalState(input.phone);

        if (!state) {
          await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
          return {
            text: 'Error interno: no se pudo resolver el estado de la cuenta.',
            flow: undefined,
            step: undefined,
          };
        }

        const shouldKeepRegisterSession =
          existingProfessional.status === ProfessionalStatus.PENDING ||
          existingProfessional.status === ProfessionalStatus.UNDER_REVIEW;

        if (shouldKeepRegisterSession) {
          await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
          return {
            text: state.responseText,
            flow: undefined,
            step: undefined,
          };
        }

        const tempData = await this.buildProfessionalTempData(
          userIdentity,
          state.requestId,
        );

        session = await this.botRepository.upsert(input.phone, {
          role,
          currentFlow: state.flowName,
          currentStep: state.stepName,
          tempData: tempData as Prisma.InputJsonValue,
        });

        if (!state.flowName) {
          await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
          return {
            text: state.responseText,
            flow: undefined,
            step: undefined,
          };
        }

        observationWarning = state.observationWarning;
      }
    }

    if (!session) {
      if (role === 'PROFESSIONAL') {
        const state = await this.resolveProfessionalState(input.phone);

        if (state) {
          observationWarning = state.observationWarning;

          const tempData = await this.buildProfessionalTempData(
            userIdentity,
            state.requestId,
          );

          session = await this.botRepository.upsert(input.phone, {
            role,
            currentFlow: state.flowName,
            currentStep: state.stepName,
            tempData: tempData as Prisma.InputJsonValue,
          });

          if (!state.flowName) {
            return {
              text: state.responseText,
              flow: undefined,
              step: undefined,
            };
          }
        }
      }

      if (!session) {
        const handler = resolveFlowHandler(role);

        session = await this.botRepository.upsert(input.phone, {
          role,
          currentFlow: handler.flowName,
          currentStep: handler.getInitialStep(),
          tempData: userIdentity as Prisma.InputJsonValue,
        });
      }
    } else {
      const sessionTempData = (session.tempData as Record<string, unknown>) || {};

      if (!sessionTempData.userId) {
        sessionTempData.userId = userIdentity.userId;
        if (!sessionTempData.name) sessionTempData.name = userIdentity.name || '';
        sessionTempData.phone = userIdentity.phone;

        session = await this.botRepository.upsert(input.phone, {
          role,
          currentFlow: session.currentFlow,
          currentStep: session.currentStep,
          tempData: sessionTempData as Prisma.InputJsonValue,
        });
      }
    }

    await this.botRepository.updateLastInboundAt(input.phone, role, new Date());

    const sessionTempData = (session.tempData as Record<string, unknown>) || {};

    const hasPendingMessage = !!sessionTempData.pendingMessage;
    if (hasPendingMessage) {
      const { ['pendingMessage']: _, ...cleanTempData } = sessionTempData as Record<string, unknown>;

      session = await this.botRepository.upsert(input.phone, {
        role,
        currentFlow: session.currentFlow,
        currentStep: session.currentStep,
        tempData: cleanTempData as Prisma.InputJsonValue,
      });
    }

    const userText = input.text?.trim();
    if (userText && isCancellationIntent(userText) && session.currentFlow) {
      const freshTempData = (session.tempData as Record<string, unknown>) || {};
      const userId = freshTempData.userId as string | undefined;

      if (userId) {
        const activeRequest = await this.requestsRepository.findActiveByUserId(userId);

        if (activeRequest && session.currentStep !== 'CANCEL_CONFIRMATION') {
          const updatedTempData: Record<string, unknown> = {
            ...freshTempData,
            _previousFlow: session.currentFlow,
            _previousStep: session.currentStep,
            requestId: activeRequest.id,
          };

          session = await this.botRepository.upsert(input.phone, {
            role,
            currentFlow: session.currentFlow,
            currentStep: 'CANCEL_CONFIRMATION',
            tempData: updatedTempData as Prisma.InputJsonValue,
          });
        }
      }
    }

    if (!session.currentFlow) {
      if (role === 'PROFESSIONAL') {
        const state = await this.resolveProfessionalState(input.phone);

        if (state) {
          observationWarning = observationWarning || state.observationWarning;

          const tempData = await this.buildProfessionalTempData(
            userIdentity,
            state.requestId,
          );

          session = await this.botRepository.upsert(input.phone, {
            role,
            currentFlow: state.flowName,
            currentStep: state.stepName,
            tempData: tempData as Prisma.InputJsonValue,
          });

          if (!state.flowName) {
            return {
              text: state.responseText,
              flow: undefined,
              step: undefined,
            };
          }
        }
      }

      if (!session.currentFlow) {
        const handler = resolveFlowHandler(role);
        session.currentFlow = handler.flowName;
        session.currentStep = handler.getInitialStep();
      }
    }

    const flowHandler = getFlowHandlerByName(session.currentFlow);
    if (!flowHandler) {
      return {
        text: 'Error interno: flujo no encontrado. Reinicia la conversacion con "hola".',
        flow: undefined,
        step: undefined,
      };
    }

    const step = session.currentStep || flowHandler.getInitialStep();

    const imageUrls = step === 'ASK_PHOTOS' ? input.imageUrls : undefined;
    const audioUrl = step === 'ASK_AUDIO' ? input.audioUrl : undefined;

    const context: FlowContext = {
      session,
      message: {
        phone: input.phone,
        text: input.text,
        imageUrls,
        audioUrl,
        location: input.location,
      },
    };

    const result = await flowHandler.handleStep(step, context);

    if (observationWarning) {
      result.response.text = observationWarning + '\n\n' + result.response.text;
    }

    const resultTempData = (result.tempData as Record<string, unknown>) || {};
    const pendingNotification = resultTempData.pendingNotification as PendingNotification | undefined;

    const finalTempData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(resultTempData)) {
      if (key !== 'pendingNotification') {
        finalTempData[key] = value;
      }
    }

    if (!finalTempData.userId) finalTempData.userId = userIdentity.userId;
    if (!finalTempData.name && userIdentity.name) finalTempData.name = userIdentity.name;
    if (!finalTempData.phone) finalTempData.phone = userIdentity.phone;

    const updatedSession = await this.botRepository.upsert(input.phone, {
      role,
      currentFlow: result.nextStep ? session.currentFlow : undefined,
      currentStep: result.nextStep || undefined,
      tempData: result.nextStep ? (finalTempData as Prisma.InputJsonValue) : ({} as Prisma.InputJsonValue),
    });

    if (pendingNotification) {
      console.log('[pendingNotification] targetPhone:', pendingNotification.targetPhone, 'step:', pendingNotification.step, 'tempData:', JSON.stringify(pendingNotification.tempData));

      const targetTempData: Record<string, unknown> = {
        ...pendingNotification.tempData,
        pendingMessage: pendingNotification.message,
        userId: pendingNotification.tempData.userId,
      };

      await this.botRepository.upsert(pendingNotification.targetPhone, {
        role: pendingNotification.targetRole,
        currentFlow: pendingNotification.flow,
        currentStep: pendingNotification.step,
        tempData: targetTempData as Prisma.InputJsonValue,
      });
    }

    return {
      text: result.response.text,
      mediaUrls: result.response.mediaUrls,
      audioUrl: result.response.audioUrl,
      options: result.response.options,
      requestId: result.response.requestId,
      flow: updatedSession.currentFlow || undefined,
      step: updatedSession.currentStep || undefined,
      pendingNotification: pendingNotification || undefined,
    };
  }

  async resetSession(phone: string): Promise<void> {
    await this.botRepository.deleteByPhone(phone);
  }

  private async buildProfessionalTempData(
    userIdentity: { userId: string; name: string; phone: string },
    requestId?: string,
  ): Promise<Record<string, unknown>> {
    const tempData: Record<string, unknown> = { ...userIdentity };

    if (!requestId) {
      return tempData;
    }

    tempData.requestId = requestId;

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        category: { select: { name: true } },
        geoNode: { select: { name: true } },
        description: true,
        photoUrls: true,
        audioUrl: true,
      },
    });

    if (!request) {
      return tempData;
    }

    tempData.categoryName = request.category?.name || 'el servicio';
    tempData.zoneName = request.geoNode?.name || 'tu zona';
    tempData.description = request.description;
    tempData.photoUrls = request.photoUrls;
    tempData.audioUrl = request.audioUrl || undefined;

    return tempData;
  }

  private async resolveProfessionalState(phone: string): Promise<{
    flowName: string | null;
    stepName: string | null;
    responseText: string;
    observationWarning?: string;
    requestId?: string;
  } | null> {
    const existing = await this.professionalsRepository.findByPhone(phone);
    if (!existing) return null;

    let responseText = '';
    let flowName: string | null = null;
    let stepName: string | null = null;
    let observationWarning: string | undefined;
    let requestId: string | undefined;

    switch (existing.status) {
      case ProfessionalStatus.PENDING:
        responseText = 'Tu registro está siendo procesado. Te enviamos un enlace de verificación. Si no lo recibiste, escribinos.';
        break;
      case ProfessionalStatus.UNDER_REVIEW:
        responseText = 'Tu perfil está siendo revisado por nuestro equipo. Te notificaremos cuando esté listo.';
        break;
      case ProfessionalStatus.ACTIVE: {
        const activeRequest = await prisma.request.findFirst({
          where: {
            assignedProfessionalId: existing.id,
            status: { in: ['ASSIGNED', 'ACCEPTED'] },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (activeRequest) {
          flowName = 'COORDINATION';
          stepName = activeRequest.status === 'ASSIGNED'
            ? 'AWAITING_ACCEPTANCE'
            : 'AWAITING_AVAILABILITY';
          requestId = activeRequest.id;
        } else {
          responseText = `Hola ${existing.name}! Tu cuenta está activa. Te notificaremos cuando tengas un nuevo pedido asignado.`;
        }
        break;
      }
      case ProfessionalStatus.OBSERVATION: {
        observationWarning = 'Tu cuenta está en observación. Seguís operando normalmente.';

        const activeRequest = await prisma.request.findFirst({
          where: {
            assignedProfessionalId: existing.id,
            status: { in: ['ASSIGNED', 'ACCEPTED'] },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (activeRequest) {
          flowName = 'COORDINATION';
          stepName = activeRequest.status === 'ASSIGNED'
            ? 'AWAITING_ACCEPTANCE'
            : 'AWAITING_AVAILABILITY';
          requestId = activeRequest.id;
        } else {
          responseText = 'Tu cuenta está en observación. Seguís operando normalmente. Te notificaremos cuando tengas un nuevo pedido asignado.';
          observationWarning = undefined;
        }
        break;
      }
      case ProfessionalStatus.PAUSED:
        responseText = 'Tu cuenta está pausada. Para reactivarla, ingresá a tu panel.';
        break;
      case ProfessionalStatus.SUSPENDED:
        responseText = 'Tu cuenta está suspendida. Para más información, contactá a soporte.';
        break;
      case ProfessionalStatus.REJECTED:
        responseText = 'Tu solicitud fue rechazada. Para más información, contactá a soporte.';
        break;
    }

    return { flowName, stepName, responseText, observationWarning, requestId };
  }
}
