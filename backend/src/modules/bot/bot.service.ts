import { randomUUID } from 'crypto';
import { BotRepository } from './bot.repository';
import { resolveFlowHandler, getFlowHandlerByName } from './flows/flow-handler.factory';
import { FlowContext, BotResponse, LocationData, PendingNotification } from './flows/types';
import { detectCancellationIntent } from './flows/cancel-flow.helper';
import { UsersService } from '../users/users.service';
import { RequestsRepository } from '../requests/requests.repository';
import { ProfessionalsRepository } from '../professionals/professionals.repository';
import { BOT_PAYLOADS } from './constants/bot-payloads';
import { formatDateTimeArgentina } from '../../utils/date-utils';
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
      await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
      return {
        text: 'Tu cuenta está suspendida temporalmente por uso irregular. Si creés que es un error, escribinos a soporte@noraconecta.com',
        flow: undefined,
        step: undefined,
      };
    }

    if (role === 'PROFESSIONAL') {
      const professional = await this.professionalsRepository.findByPhone(input.phone);
      if (professional?.status === 'SUSPENDED') {
        await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
        return {
          text: 'Tu cuenta está suspendida temporalmente por uso irregular. Si creés que es un error, escribinos a soporte@noraconecta.com',
          flow: undefined,
          step: undefined,
        };
      }

      // Handle ver_como_funciona payload from membership activation notification
      if (input.text?.trim() === BOT_PAYLOADS.VER_COMO_FUNCIONA) {
        await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
        return {
          text: [
            'Así funciona NORA:',
            '',
            '1. Cuando un usuario necesite tu servicio en tu zona, te llegará un pedido directo.',
            '2. Vas a ver los detalles y podés aceptarlo o indicar que ahora no podés.',
            '3. Si aceptás, coordinás la visita con el usuario por acá mismo.',
            '4. Al terminar el trabajo, el usuario te califica.',
            '',
            'Cuanto mejor sea tu respuesta y tus calificaciones, más pedidos vas a recibir. ¡Éxitos!',
          ].join('\n'),
          flow: undefined,
          step: undefined,
        };
      }
    }

    let session = await this.botRepository.findByPhoneAndRole(input.phone, role);

    console.log('[processMessage:session]', {
      phone: input.phone,
      role,
      currentFlow: session?.currentFlow,
      currentStep: session?.currentStep,
      updatedAt: session?.updatedAt,
    });

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
            await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
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

        let initialTempData: Record<string, unknown> = { ...userIdentity };

        if (role === 'USER' && input.text?.trim()) {
          const { extractServiceAndZone } = await import('../../lib/llm-client');
          const extracted = await extractServiceAndZone(input.text.trim());
          if (extracted.serviceName || extracted.zoneName) {
            initialTempData._extractedServiceName = extracted.serviceName;
            initialTempData._extractedZoneName = extracted.zoneName;
          }
        }

        session = await this.botRepository.upsert(input.phone, {
          role,
          currentFlow: handler.flowName,
          currentStep: handler.getInitialStep(),
          tempData: initialTempData as Prisma.InputJsonValue,
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
    if (
      userText &&
      session.currentFlow &&
      session.currentStep !== 'CANCEL_CONFIRMATION' &&
      session.currentStep !== 'SELECT_CANCEL_REQUEST'
    ) {
      const hasCancelIntent = await detectCancellationIntent(userText);

      if (hasCancelIntent) {
        const freshTempData = (session.tempData as Record<string, unknown>) || {};

        if (role === 'USER') {
          const userId = freshTempData.userId as string | undefined;

          if (userId) {
            const activeRequest = await this.requestsRepository.findActiveByUserId(userId);

            if (activeRequest) {
              const updatedTempData: Record<string, unknown> = {
                ...freshTempData,
                _previousFlow: session.currentFlow,
                _previousStep: session.currentStep,
                requestId: activeRequest.id,
                categoryName: activeRequest.category?.name || 'el servicio',
                phone: input.phone,
              };

              session = await this.botRepository.upsert(input.phone, {
                role,
                currentFlow: session.currentFlow,
                currentStep: 'CANCEL_CONFIRMATION',
                tempData: updatedTempData as Prisma.InputJsonValue,
              });

              await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
              return {
                text: `¿Confirmás que querés cancelar tu pedido de ${activeRequest.category?.name || 'tu servicio'}?\n1. Sí, cancelar\n2. No, seguir con el pedido`,
                flow: session.currentFlow || undefined,
                step: 'CANCEL_CONFIRMATION',
              };
            }
          }
        } else if (role === 'PROFESSIONAL') {
          const professional = await this.professionalsRepository.findByPhone(input.phone);

          if (professional) {
            const activeRequests = await this.requestsRepository.findActivesByProfessionalId(professional.id);

            if (activeRequests.length === 1) {
              const r = activeRequests[0];
              const updatedTempData: Record<string, unknown> = {
                ...freshTempData,
                _previousFlow: session.currentFlow,
                _previousStep: session.currentStep,
                requestId: r.id,
                professionalId: professional.id,
                categoryName: r.category?.name || 'el servicio',
                phone: input.phone,
              };

              session = await this.botRepository.upsert(input.phone, {
                role,
                currentFlow: session.currentFlow,
                currentStep: 'CANCEL_CONFIRMATION',
                tempData: updatedTempData as Prisma.InputJsonValue,
              });
            } else if (activeRequests.length > 1) {
              const list = activeRequests
                .map((r, i) => {
                  const date = r.scheduledAt
                    ? ` (visita el ${formatDateTimeArgentina(r.scheduledAt)})`
                    : ' (pendiente de confirmar)';
                  return `${i + 1}. ${r.category?.name || 'Servicio'} en ${r.geoNode?.name || 'tu zona'}${date}`;
                })
                .join('\n');

              session = await this.botRepository.upsert(input.phone, {
                role,
                currentFlow: session.currentFlow,
                currentStep: 'SELECT_CANCEL_REQUEST',
                tempData: {
                  ...freshTempData,
                  professionalId: professional.id,
                  phone: input.phone,
                  _cancelCandidates: activeRequests.map((r) => r.id),
                  _cancelRequestsData: activeRequests.map((r) => ({
                    id: r.id,
                    categoryName: r.category?.name || 'Servicio',
                    geoNodeName: r.geoNode?.name || 'tu zona',
                    scheduledAt: r.scheduledAt?.toISOString() || null,
                  })),
                } as Prisma.InputJsonValue,
              });

              await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
              return {
                text: `¿Cuál pedido querés cancelar?\n${list}`,
                flow: session.currentFlow || undefined,
                step: session.currentStep || undefined,
              };
            }
          }
        }
      }
    }

    if (userText && session.currentStep === 'SELECT_CANCEL_REQUEST' && role === 'PROFESSIONAL') {
      const freshTempData = (session.tempData as Record<string, unknown>) || {};
      const candidates = freshTempData._cancelCandidates as string[] | undefined;
      const requestsData = freshTempData._cancelRequestsData as
        | { id: string; categoryName: string; geoNodeName: string; scheduledAt: string | null }[]
        | undefined;

      if (candidates && requestsData && candidates.length > 0) {
        const index = parseInt(userText, 10);

        if (index >= 1 && index <= candidates.length) {
          const selectedId = candidates[index - 1];
          const selectedData = requestsData[index - 1];

          session = await this.botRepository.upsert(input.phone, {
            role,
            currentFlow: session.currentFlow,
            currentStep: 'CANCEL_CONFIRMATION',
            tempData: {
              ...freshTempData,
              _previousFlow: session.currentFlow,
              _previousStep: 'SELECT_CANCEL_REQUEST',
              requestId: selectedId,
              professionalId: freshTempData.professionalId,
              categoryName: selectedData.categoryName,
              phone: input.phone,
            } as Prisma.InputJsonValue,
          });

          await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
          return {
            text: `¿Confirmás que querés cancelar tu pedido de ${selectedData.categoryName}?\n1. Sí, cancelar\n2. No, seguir con el pedido`,
            flow: session.currentFlow || undefined,
            step: 'CANCEL_CONFIRMATION',
          };
        }

        // Invalid number: re-show the list
        const list = requestsData
          .map((r, i) => {
            const date = r.scheduledAt
              ? ` (visita el ${formatDateTimeArgentina(new Date(r.scheduledAt))})`
              : ' (pendiente de confirmar)';
            return `${i + 1}. ${r.categoryName} en ${r.geoNodeName}${date}`;
          })
          .join('\n');

        return {
          text: `Respondé con un número del 1 al ${candidates.length}.\n${list}`,
          flow: session.currentFlow || undefined,
          step: 'SELECT_CANCEL_REQUEST',
        };
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
            await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
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
      await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
      return {
        text: 'Error interno: flujo no encontrado. Reinicia la conversacion con "hola".',
        flow: undefined,
        step: undefined,
      };
    }

    const step = session.currentStep || flowHandler.getInitialStep();

    const imageUrls = step === 'ASK_PHOTOS' ? input.imageUrls : undefined;
    const audioUrl = (step === 'ASK_AUDIO' || step === 'ASK_DESCRIPTION' || step === 'CLARIFICATION') ? input.audioUrl : undefined;

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
      currentFlow: result.nextStep ? session.currentFlow : null,
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

    const hasMedia = (request.photoUrls && request.photoUrls.length > 0) || !!request.audioUrl;
    if (!hasMedia) {
      tempData._detailsShown = true;
    }

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
      case ProfessionalStatus.PENDING: {
        const APP_URL = process.env.APP_URL || 'http://app.noraconecta.local';
        const now = new Date();

        const isTokenExpired =
          !existing.verificationToken ||
          !existing.verificationTokenExp ||
          now > existing.verificationTokenExp ||
          existing.verificationTokenUsed;

        let verificationToken = existing.verificationToken;

        if (isTokenExpired) {
          verificationToken = randomUUID();
          const verificationTokenExp = new Date(
            Date.now() + 168 * 60 * 60 * 1000,
          );

          await this.professionalsRepository.update(existing.id, {
            verificationToken,
            verificationTokenExp,
            verificationTokenUsed: false,
          });
        }

        const verificationUrl = `${APP_URL}/verify/${verificationToken}`;

        if (isTokenExpired) {
          responseText = `¡Hola ${existing.name}! Tu enlace anterior venció. Te generamos uno nuevo para que puedas completar tu verificación: ${verificationUrl}`;
        } else {
          responseText = `¡Hola ${existing.name}! Todavía tenés el registro pendiente. Para activar tu cuenta en NORA completá la verificación desde este enlace: ${verificationUrl}`;
        }
        break;
      }
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
