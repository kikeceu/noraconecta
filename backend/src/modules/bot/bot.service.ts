import { randomUUID } from 'crypto';
import { BotRepository } from './bot.repository';
import { resolveFlowHandler, getFlowHandlerByName } from './flows/flow-handler.factory';
import { FlowContext, BotResponse, LocationData, PendingNotification } from './flows/types';
import { detectCancellationIntent } from './flows/cancel-flow.helper';
import { UsersService } from '../users/users.service';
import { RequestsRepository } from '../requests/requests.repository';
import { ProfessionalsRepository } from '../professionals/professionals.repository';
import { ProfessionalsService } from '../professionals/professionals.service';
import { SecurityService } from './security.service';
import { BOT_PAYLOADS } from './constants/bot-payloads';
import { isAckMessage } from './flows/ack-detector.helper';
import { formatDateTimeArgentina } from '../../utils/date-utils';
import prisma from '../../lib/prisma';
import { BotSession, Prisma, BotRole, ProfessionalStatus } from '@prisma/client';
import type { User } from '@prisma/client';

const EMPTY_WORDS = new Set([
  'hola', 'buenas', 'buenos', 'buen', 'dias', 'tardes', 'noches',
  'dia', 'noche', 'tarde', 'hey', 'hi', 'nora', 'como', 'estas',
  'esta', 'que', 'tal', 'ahi', 'aca', 'por', 'favor', 'gracias',
  'ok', 'dale', 'okey', 'bien', 'bueno', 'holis', 'holaa', 'holiii',
]);

const STEPS_EXPECTING_RESPONSE = [
  'CONFIRM',
  'AWAITING_CONFIRMATION',
  'AWAITING_USER_CONFIRMATION',
  'AWAITING_ACCEPTANCE',
  'AWAITING_VISIT_CONFIRMATION',
  'CANCEL_CONFIRMATION',
  'WAITING_CONSENT',
  'FEEDBACK_RECOMMEND',
  'FEEDBACK_PRO_RECOMMEND',
  'AWAITING_WORK_COMPLETION',
  'POST_CANCEL',
  'CONFIRM_SERVICE',
  'DESCRIPTION_MISMATCH',
  'ASK_SAVED_LOCATION_SINGLE',
  'CONFIRM_AVAILABILITY',
  'CONFIRM_PRO_AVAILABILITY',
  'AWAITING_VISIT',
  'AWAITING_AVAILABILITY',
  'SELECT_NEW_REQUEST_CONFIRM',
];

function hasActionableContent(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < 3) return false;

  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  const meaningfulWords = normalized
    .split(/\s+/)
    .filter(w => w.length > 2 && !EMPTY_WORDS.has(w));

  return meaningfulWords.length >= 2;
}

const PANEL_KEYWORDS = ['panel', 'link', 'url', 'acceso', 'entrar', 'ingresar', 'cuenta', 'login'];

function wantsPanelLink(text: string): boolean {
  const lower = text.toLowerCase();
  return PANEL_KEYWORDS.some((kw) => lower.includes(kw));
}

export type ProcessMessageInput = {
  phone: string;
  text?: string;
  imageUrls?: string[];
  audioUrl?: string;
  location?: LocationData;
  buttonPayload?: string;
  role?: BotRole;
};

export class BotService {
  constructor(
    private readonly botRepository: BotRepository,
    private readonly usersService: UsersService,
    private readonly requestsRepository: RequestsRepository,
    private readonly professionalsRepository: ProfessionalsRepository,
    private readonly professionalsService: ProfessionalsService,
    private readonly securityService: SecurityService,
  ) {}

  async processMessage(
    input: ProcessMessageInput,
  ): Promise<BotResponse & { flow?: string; step?: string; pendingNotification?: PendingNotification }> {
    const securityResult = await this.securityService.check(input.phone, input.text);
    if (securityResult.blocked) {
      return {
        text: securityResult.responseText!,
        flow: undefined,
        step: undefined,
      };
    }

    const role: BotRole = input.role || 'USER';
    let user: User | { id: string; name: string; phone: string };
    let session: Awaited<ReturnType<typeof this.botRepository.findByPhoneAndRole>>;

    if (role === 'USER') {
      [user, session] = await Promise.all([
        this.usersService.findOrCreateByPhone(input.phone),
        this.botRepository.findByPhoneAndRole(input.phone, role),
      ]);
    } else {
      user = (await this.usersService.findByPhone(input.phone)) ?? { id: '', name: '', phone: input.phone };
      session = await this.botRepository.findByPhoneAndRole(input.phone, role);
    }

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

    if (role === 'USER' && input.text?.trim() && isAckMessage(input.text.trim())) {
      const currentStep = session?.currentStep;
      if (!currentStep || !STEPS_EXPECTING_RESPONSE.includes(currentStep)) {
        await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
        return { text: '', flow: undefined, step: undefined };
      }
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

      // Detect panel link intent via keywords
      if (input.text && wantsPanelLink(input.text.trim())) {
        await this.botRepository.updateLastInboundAt(input.phone, role, new Date());

        if (professional && professional.status === 'ACTIVE') {
          const { sessionToken: _sessionToken, panelUrl } =
            await this.professionalsService.generateSessionToken(professional.id);

          return {
            text: `Hola ${professional.name}! Acá tenés el link para acceder a tu panel:\n\n${panelUrl}\n\nEste link es personal y tiene validez por 30 días.`,
            flow: undefined,
            step: undefined,
          };
    }

    return {
          text: 'Tu cuenta no está activa. Para más información, contactá a soporte.',
          flow: undefined,
          step: undefined,
        };
      }
    }

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
        const state = await this.resolveProfessionalState(input.phone, input.text);

        if (!state) {
          await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
          return {
            text: 'Error interno: no se pudo resolver el estado de la cuenta.',
            flow: undefined,
            step: undefined,
          };
        }

        const shouldKeepRegisterSession =
          (existingProfessional.status === ProfessionalStatus.PENDING ||
            existingProfessional.status === ProfessionalStatus.UNDER_REVIEW) &&
          session?.currentStep !== 'ASK_LICENSE_EARLY';

        if (shouldKeepRegisterSession) {
          await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
          return {
            text: state.responseText,
            flow: undefined,
            step: undefined,
          };
        }

        if (session?.currentStep === 'ASK_LICENSE_EARLY') {
          // Let the flow handle the message — don't overwrite session
        } else {
          const tempData = await this.buildProfessionalTempData(
            userIdentity,
            state.requestId,
          );

          if (state.lastStatusMessageSentAt) {
            tempData.lastStatusMessageSentAt = state.lastStatusMessageSentAt;
          }

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

        observationWarning = state.observationWarning;
      }
    }

    if (
      role === 'USER' &&
      input.text?.trim() &&
      !hasActionableContent(input.text.trim()) &&
      !session?.currentFlow
    ) {
      const existingTempData = (session?.tempData as Record<string, unknown>) || {};
      const lastUserGreetingAt = existingTempData.lastUserGreetingAt as string | undefined;
      const alreadyGreetedToday = lastUserGreetingAt
        ? new Date(lastUserGreetingAt).toDateString() === new Date().toDateString()
        : false;

      const userName =
        userIdentity.name && userIdentity.name !== userIdentity.phone
          ? userIdentity.name
          : null;

      const isNewUser = !userIdentity.name || userIdentity.name === userIdentity.phone;

      let greetingText: string;
      if (alreadyGreetedToday) {
        greetingText =
          '¡Acá estoy! Escribime qué servicio necesitás y en qué zona.';
      } else if (isNewUser) {
        greetingText = `¡Hola! Soy ${process.env.APP_NAME ?? 'NORA'} 👋 Te conecto con profesionales del hogar cerca tuyo. ¿Cómo te llamás?`;
      } else {
        greetingText = userName
          ? `¡Hola ${userName}! 👋 Cuando necesites un profesional del hogar, escribime qué servicio buscás y en qué zona.`
          : '¡Hola! 👋 Cuando necesites un profesional del hogar, escribime qué servicio buscás y en qué zona.';

        await this.botRepository.upsert(input.phone, {
          role,
          currentFlow: session?.currentFlow ?? null,
          currentStep: session?.currentStep ?? null,
          tempData: {
            ...existingTempData,
            lastUserGreetingAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        });
      }

      await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
      return {
        text: greetingText,
        flow: undefined,
        step: undefined,
      };
    }

    if (!session) {
      if (role === 'PROFESSIONAL') {
        const state = await this.resolveProfessionalState(input.phone, input.text);

        if (state) {
          observationWarning = state.observationWarning;

          const tempData = await this.buildProfessionalTempData(
            userIdentity,
            state.requestId,
          );

          if (state.lastStatusMessageSentAt) {
            tempData.lastStatusMessageSentAt = state.lastStatusMessageSentAt;
          }

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

      const handler = resolveFlowHandler(role);

        const initialTempData: Record<string, unknown> = { ...userIdentity };

        if (role === 'USER' && input.text?.trim() && hasActionableContent(input.text.trim())) {
          const { extractServiceAndZone, extractName } = await import('../../lib/llm-client');
          const [extracted, extractedName] = await Promise.all([
            extractServiceAndZone(input.text.trim()),
            extractName(input.text.trim()),
          ]);

          if (extracted.serviceName || extracted.zoneName) {
            initialTempData._extractedServiceName = extracted.serviceName;
            initialTempData._extractedZoneName = extracted.zoneName;
          }

          const isNameless = !userIdentity.name || userIdentity.name === userIdentity.phone;
          if (extractedName && isNameless) {
            initialTempData.name = extractedName;
            initialTempData._isNewUser = true;
            await this.usersService.updateName(userIdentity.userId, extractedName);
          }
        }

        session = await this.botRepository.upsert(input.phone, {
          role,
          currentFlow: handler.flowName,
          currentStep: handler.getInitialStep(),
          tempData: initialTempData as Prisma.InputJsonValue,
        });
    } else {
      const sessionTempData = (session.tempData as Record<string, unknown>) || {};

      if (!sessionTempData.userId) {
        sessionTempData.userId = userIdentity.userId;
        if (!sessionTempData.name) sessionTempData.name = userIdentity.name || '';
        sessionTempData.phone = userIdentity.phone;
      }

      if (!session.currentFlow && role === 'USER' && input.text?.trim() && hasActionableContent(input.text.trim())) {
        const { extractServiceAndZone, extractName } = await import('../../lib/llm-client');
        const [extracted, extractedName] = await Promise.all([
          extractServiceAndZone(input.text.trim()),
          extractName(input.text.trim()),
        ]);
        if (extracted.serviceName || extracted.zoneName) {
          sessionTempData._extractedServiceName = extracted.serviceName;
          sessionTempData._extractedZoneName = extracted.zoneName;
        }
        const isNameless = !userIdentity.name || userIdentity.name === userIdentity.phone;
        if (extractedName && isNameless) {
          sessionTempData.name = extractedName;
          sessionTempData._isNewUser = true;
          await this.usersService.updateName(userIdentity.userId, extractedName);
        }
      }

      session = await this.botRepository.upsert(input.phone, {
        role,
        currentFlow: session.currentFlow,
        currentStep: session.currentStep,
        tempData: { ...(session.tempData as Record<string, unknown>), ...sessionTempData } as Prisma.InputJsonValue,
      });
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
      (session.currentFlow || role === 'PROFESSIONAL') &&
      session.currentStep !== 'CANCEL_CONFIRMATION' &&
      session.currentStep !== 'SELECT_CANCEL_REQUEST' &&
      session.currentStep !== 'SELECT_CANCEL_USER_REQUEST' &&
      session.currentStep !== 'SELECT_NEW_REQUEST_CONFIRM'
    ) {
      const hasCancelIntent = await detectCancellationIntent(userText);

      if (hasCancelIntent) {
        const freshTempData = (session.tempData as Record<string, unknown>) || {};

        if (role === 'USER') {
          const userSessions = await this.botRepository.findActiveUserRequestSessions(input.phone);

          if (userSessions.length > 1) {
            const list = userSessions
              .map((s, i) => {
                const data = (s.tempData as Record<string, unknown>) || {};
                const categoryName = (data.categoryName as string) || 'Servicio';
                const geoNodeName = data.geoNodeName as string | undefined;
                const clientAddress = data.clientAddress as string | undefined;

                let label = categoryName;
                if (geoNodeName) label += ` en ${geoNodeName}`;
                if (clientAddress) label += ` - ${clientAddress}`;

                return `${i + 1}. ${label}`;
              })
              .join('\n');

            session = await this.botRepository.upsert(input.phone, {
              role,
              currentFlow: session.currentFlow,
              currentStep: 'SELECT_CANCEL_USER_REQUEST',
              tempData: {
                ...freshTempData,
                _previousFlow: session.currentFlow,
                _previousStep: session.currentStep,
                _activeUserSessions: userSessions.map((s) => {
                  const data = (s.tempData as Record<string, unknown>) || {};
                  return {
                    requestId: s.requestId,
                    categoryName: data.categoryName,
                    geoNodeName: data.geoNodeName,
                    clientAddress: data.clientAddress,
                  };
                }),
                phone: input.phone,
              } as Prisma.InputJsonValue,
            });

            await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
            return {
              text: `¿Cuál pedido querés cancelar?\n${list}`,
              flow: session.currentFlow || undefined,
              step: 'SELECT_CANCEL_USER_REQUEST',
            };
          } else if (userSessions.length === 1) {
            const s = userSessions[0];
            const data = (s.tempData as Record<string, unknown>) || {};
            const categoryName = (data.categoryName as string) || 'el servicio';

            session = await this.botRepository.upsert(input.phone, {
              role,
              currentFlow: session.currentFlow,
              currentStep: 'CANCEL_CONFIRMATION',
              tempData: {
                ...freshTempData,
                _previousFlow: session.currentFlow,
                _previousStep: session.currentStep,
                requestId: s.requestId,
                categoryName,
                phone: input.phone,
              } as Prisma.InputJsonValue,
            });

            await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
            return {
              text: `¿Confirmás que querés cancelar tu pedido de ${categoryName}?\n1. Sí, cancelar\n2. No, seguir con el pedido`,
              flow: session.currentFlow || undefined,
              step: 'CANCEL_CONFIRMATION',
            };
          } else {
            session = await this.botRepository.upsert(input.phone, {
              role,
              currentFlow: 'USER_REQUEST',
              currentStep: 'POST_CANCEL',
              tempData: { ...freshTempData } as Prisma.InputJsonValue,
            });
            await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
            return {
              text: 'Entendido, cancelé el pedido.\n1. Iniciar un nuevo pedido\n2. Por ahora no, gracias',
              flow: 'USER_REQUEST',
              step: 'POST_CANCEL',
            };
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
                clientAddress: r.clientAddress || null,
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
                  return `${i + 1}. ${r.category?.name || 'Servicio'} en ${r.geoNode?.name || 'tu zona'}${r.clientAddress ? ` - ${r.clientAddress}` : ''}${date}`;
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
                    clientAddress: r.clientAddress || null,
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
        | { id: string; categoryName: string; geoNodeName: string; scheduledAt: string | null; clientAddress: string | null }[]
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
            text: `¿Confirmás que querés cancelar tu pedido de ${selectedData.categoryName}${selectedData.clientAddress ? ` en ${selectedData.clientAddress}` : ''}?\n1. Sí, cancelar\n2. No, seguir con el pedido`,
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
            return `${i + 1}. ${r.categoryName} en ${r.geoNodeName}${r.clientAddress ? ` - ${r.clientAddress}` : ''}${date}`;
          })
          .join('\n');

        return {
          text: `Respondé con un número del 1 al ${candidates.length}.\n${list}`,
          flow: session.currentFlow || undefined,
          step: 'SELECT_CANCEL_REQUEST',
        };
      }
    }

    if (userText && session.currentStep === 'SELECT_CANCEL_USER_REQUEST' && role === 'USER') {
      const freshTempData = (session.tempData as Record<string, unknown>) || {};
      const activeSessions = freshTempData._activeUserSessions as Array<{
        requestId: string;
        categoryName: string;
        geoNodeName?: string;
        clientAddress?: string;
      }> | undefined;

      if (activeSessions) {
        const index = parseInt(userText, 10);

        if (index >= 1 && index <= activeSessions.length) {
          const selected = activeSessions[index - 1];

          session = await this.botRepository.upsert(input.phone, {
            role,
            currentFlow: session.currentFlow,
            currentStep: 'CANCEL_CONFIRMATION',
            tempData: {
              ...freshTempData,
              _previousFlow: freshTempData._previousFlow || session.currentFlow,
              _previousStep: 'SELECT_CANCEL_USER_REQUEST',
              requestId: selected.requestId,
              categoryName: selected.categoryName,
              phone: input.phone,
            } as Prisma.InputJsonValue,
          });

          await this.botRepository.updateLastInboundAt(input.phone, role, new Date());

          const cancelLabel = [
            selected.categoryName,
            selected.geoNodeName ? `en ${selected.geoNodeName}` : null,
            selected.clientAddress ? `- ${selected.clientAddress}` : null,
          ].filter(Boolean).join(' ');

          return {
            text: `¿Confirmás que querés cancelar tu pedido de ${cancelLabel}?\n1. Sí, cancelar\n2. No, seguir con el pedido`,
            flow: session.currentFlow || undefined,
            step: 'CANCEL_CONFIRMATION',
          };
        }

        const list = activeSessions
          .map((s, i) => {
            let label = s.categoryName || 'Servicio';
            if (s.geoNodeName) label += ` en ${s.geoNodeName}`;
            if (s.clientAddress) label += ` - ${s.clientAddress}`;
            return `${i + 1}. ${label}`;
          })
          .join('\n');

        return {
          text: `Respondé con un número del 1 al ${activeSessions.length}.\n${list}`,
          flow: session.currentFlow || undefined,
          step: 'SELECT_CANCEL_USER_REQUEST',
        };
      }
    }

    if (
      !session.currentFlow &&
      session.currentStep !== 'CANCEL_CONFIRMATION' &&
      session.currentStep !== 'SELECT_CANCEL_REQUEST' &&
      session.currentStep !== 'SELECT_CANCEL_USER_REQUEST' &&
      session.currentStep !== 'SELECT_ACTIVE_REQUEST'
    ) {
      if (role === 'PROFESSIONAL') {
        const state = await this.resolveProfessionalState(input.phone, input.text);

        if (state) {
          observationWarning = observationWarning || state.observationWarning;

          const tempData = await this.buildProfessionalTempData(
            userIdentity,
            state.requestId,
          );

          if (state.lastStatusMessageSentAt) {
            tempData.lastStatusMessageSentAt = state.lastStatusMessageSentAt;
          }

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

      if (!session.currentFlow && role === 'USER' && input.text?.trim()) {
        const userSessions = await this.botRepository.findActiveUserRequestSessions(input.phone);

        if (userSessions.length > 1) {
          const sessionTempData = (session.tempData as Record<string, unknown>) || {};
          const list = userSessions
            .map((s, i) => {
              const data = (s.tempData as Record<string, unknown>) || {};
              return `${i + 1}. ${(data.categoryName as string) || 'Servicio'}`;
            })
            .join('\n');

          session = await this.botRepository.upsert(input.phone, {
            role,
            currentFlow: 'USER_REQUEST',
            currentStep: 'SELECT_ACTIVE_REQUEST',
            tempData: {
              ...sessionTempData,
              _activeUserSessions: userSessions.map((s) => ({
                requestId: s.requestId,
                categoryName: (s.tempData as Record<string, unknown>)?.categoryName,
              })),
            } as Prisma.InputJsonValue,
          });

          await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
          return {
            text: `Tenés estos pedidos activos:\n${list}\n\n¿Sobre cuál querés continuar? Respondé con el número.`,
            flow: 'USER_REQUEST',
            step: 'SELECT_ACTIVE_REQUEST',
          };
        }

        if (userSessions.length === 1) {
          const activeSession = userSessions[0];
          session.currentFlow = 'USER_REQUEST';
          session.currentStep = activeSession.currentStep || 'WAITING';
          session.tempData = activeSession.tempData;
        }

        if (!session.currentFlow && !hasActionableContent(input.text.trim())) {
          return {
            text: '¡Hola! 👋 Cuando necesites un profesional del hogar, escribime qué servicio buscás y en qué zona.',
            flow: undefined,
            step: undefined,
          };
        }

        if (!session.currentFlow) {
          const { extractServiceAndZone, extractName } = await import('../../lib/llm-client');
          const [extracted, extractedName] = await Promise.all([
            extractServiceAndZone(input.text.trim()),
            extractName(input.text.trim()),
          ]);
          const sessionTempData = (session.tempData as Record<string, unknown>) || {};
          if (extracted.serviceName || extracted.zoneName) {
            sessionTempData._extractedServiceName = extracted.serviceName;
            sessionTempData._extractedZoneName = extracted.zoneName;
          }
          const isNameless = !userIdentity.name || userIdentity.name === userIdentity.phone;
          if (extractedName && isNameless) {
            sessionTempData.name = extractedName;
            sessionTempData._isNewUser = true;
            await this.usersService.updateName(userIdentity.userId, extractedName);
          }
          if (extracted.serviceName || extracted.zoneName || (extractedName && isNameless)) {
            const handler = resolveFlowHandler(role);
            session = await this.botRepository.upsert(input.phone, {
              role,
              currentFlow: handler.flowName,
              currentStep: handler.getInitialStep(),
              tempData: { ...sessionTempData } as Prisma.InputJsonValue,
            });
          }
        }
      }

      if (!session.currentFlow) {
        const handler = resolveFlowHandler(role);
        session.currentFlow = handler.flowName;
        session.currentStep = handler.getInitialStep();
      }
    }

    // Ensure CANCEL_CONFIRMATION and SELECT_CANCEL_REQUEST use the correct flow
    // when the session has no currentFlow. In-memory only, no DB upsert.
    if (
      (session.currentStep === 'CANCEL_CONFIRMATION' ||
        session.currentStep === 'SELECT_CANCEL_REQUEST') &&
      !session.currentFlow
    ) {
      session.currentFlow = 'COORDINATION';
    }

    if (
      userText &&
      session.currentStep === 'SELECT_ACTIVE_REQUEST' &&
      role === 'USER'
    ) {
      const sessionTempData = (session.tempData as Record<string, unknown>) || {};
      const activeSessions = sessionTempData._activeUserSessions as Array<{ requestId: string; categoryName: string }> | undefined;

      if (activeSessions) {
        const index = parseInt(userText, 10);

        if (index >= 1 && index <= activeSessions.length) {
          const selected = activeSessions[index - 1];
          const fullSession = await this.botRepository.findUserRequestSessionByRequestId(selected.requestId);

          if (fullSession) {
            session = await this.botRepository.upsert(input.phone, {
              role,
              currentFlow: 'USER_REQUEST',
              currentStep: 'WAITING',
              tempData: fullSession.tempData as Prisma.InputJsonValue,
            });

            await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
            return {
              text: `Seleccionaste tu pedido de ${selected.categoryName}. ¿Qué querés hacer?\n1. Ver estado\n2. Cancelar`,
              flow: 'USER_REQUEST',
              step: 'WAITING',
            };
          }
        }

        const list = activeSessions
          .map((s, i) => `${i + 1}. ${s.categoryName || 'Servicio'}`)
          .join('\n');

        return {
          text: `Respondé con un número del 1 al ${activeSessions.length}.\n${list}`,
          flow: 'USER_REQUEST',
          step: 'SELECT_ACTIVE_REQUEST',
        };
      }
    }

    if (
      role === 'USER' &&
      session.currentStep === 'SELECT_NEW_REQUEST_CONFIRM' &&
      userText
    ) {
      const resolved = userText.trim();

      if (resolved === '1' || resolved.toLowerCase() === 'sí' || resolved.toLowerCase() === 'si') {
        session = await this.botRepository.upsert(input.phone, {
	role,
	currentFlow: 'USER_REQUEST',
	currentStep: 'INIT',
	tempData: {} as Prisma.InputJsonValue,
	});
	return {
	  text: '¡Perfecto! ¿Qué otro servicio necesitás?',
	  flow: 'USER_REQUEST',
	  step: 'INIT',
	};
      } else {
        session = await this.botRepository.upsert(input.phone, {
          role,
          currentFlow: 'COORDINATION',
          currentStep: 'AWAITING_VISIT',
          tempData: session.tempData as Prisma.InputJsonValue,
        });
        await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
        return {
          text: 'Perfecto, te avisamos cuando haya novedades.',
          flow: 'COORDINATION',
          step: 'AWAITING_VISIT',
        };
      }
    }

    if (
      role === 'USER' &&
      session.currentFlow === 'COORDINATION' &&
      session.currentStep === 'AWAITING_VISIT' &&
      userText
    ) {
      const userSessions = await this.botRepository.findActiveUserRequestSessions(input.phone);

      const scheduledSessions = userSessions.filter((s) => {
        const data = (s.tempData as Record<string, unknown>) || {};
        return data.professionalName && data.scheduledAt;
      });

      if (scheduledSessions.length > 0) {
        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const visitList = scheduledSessions.map((s) => {
          const data = (s.tempData as Record<string, unknown>) || {};
          const professionalName = data.professionalName as string;
          const categoryName = data.categoryName as string;
          const scheduledAt = data.scheduledAt as string;
          const date = new Date(scheduledAt);
          const argDate = new Date(date.getTime() - 3 * 60 * 60 * 1000);
          const dayName = dayNames[argDate.getUTCDay()];
          const hours = argDate.getUTCHours().toString().padStart(2, '0');
          const minutes = argDate.getUTCMinutes().toString().padStart(2, '0');
          return `${professionalName} (${categoryName}) - ${dayName} a las ${hours}:${minutes}`;
        }).join('\n');

        const responseText = scheduledSessions.length === 1
          ? `Tenés una visita coordinada con ${visitList}.\nSi querés cancelarla, escribí "cancelar".\n\n¿Querés hacer un nuevo pedido de otro servicio?\n1. Sí\n2. No, gracias`
          : `Tenés estas visitas coordinadas:\n${visitList}\nSi querés cancelar alguna, escribí "cancelar".\n\n¿Querés hacer un nuevo pedido de otro servicio?\n1. Sí\n2. No, gracias`;

        session = await this.botRepository.upsert(input.phone, {
          role,
          currentFlow: 'COORDINATION',
          currentStep: 'SELECT_NEW_REQUEST_CONFIRM',
          tempData: session.tempData as Prisma.InputJsonValue,
        });

        await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
        return {
          text: responseText,
          flow: 'COORDINATION',
          step: 'SELECT_NEW_REQUEST_CONFIRM',
        };
      }
    }

    const flowHandler = getFlowHandlerByName(session.currentFlow || '');
    if (!flowHandler) {
      await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
      return {
        text: 'Error interno: flujo no encontrado. Reinicia la conversacion con "hola".',
        flow: undefined,
        step: undefined,
      };
    }

    if (role === 'PROFESSIONAL' && input.imageUrls?.length) {
      const profile = await prisma.professionalProfile.findFirst({
       where: { professional: { phone: input.phone } },
       select: { photoRequestedAt: true, photoUrl: true, professionalId: true },
      });
     
      if (profile?.photoRequestedAt && !profile.photoUrl) {
       await prisma.professionalProfile.update({
        where: { professionalId: profile.professionalId! },
        data: { photoUrl: input.imageUrls[0], photoRequestedAt: null },
      });
     
      await this.botRepository.updateLastInboundAt(input.phone, role, new Date());
     
      return {
       text: '✅ ¡Perfecto! Tu foto ya está en tu perfil. Los usuarios podrán verte antes de la visita.',
       flow: undefined,
       step: undefined,
      };
     }
    }

    let _prsRequestId: string | undefined;

    if (
      role === 'PROFESSIONAL' &&
      session.currentStep !== 'CANCEL_CONFIRMATION' &&
      session.currentStep !== 'SELECT_CANCEL_REQUEST' &&
      session.currentStep !== 'FEEDBACK_PRO_RATING' &&
      session.currentStep !== 'FEEDBACK_PRO_RECOMMEND'
    ) {
      const requestSessions = await this.botRepository.findActiveRequestSessions(input.phone);
      if (requestSessions.length > 0) {
        const activeSession = requestSessions[0];
        session.currentStep = activeSession.currentStep;
        session.tempData = activeSession.tempData;
        _prsRequestId = activeSession.requestId;
      }
    }

    const step = session.currentStep || flowHandler.getInitialStep();

    let isProfessionalProfilePhoto = false;
    if (role === 'PROFESSIONAL' && !!input.imageUrls?.length) {
      const profile = await prisma.professionalProfile.findFirst({
       where: { professional: { phone: input.phone } },
       select: { photoRequestedAt: true, photoUrl: true },
      });
      isProfessionalProfilePhoto = !!(profile?.photoRequestedAt && !profile.photoUrl);
    }

    const imageUrls =
    step === 'ASK_PHOTOS' || isProfessionalProfilePhoto
     ? input.imageUrls
     : undefined;

    const audioUrl = (step === 'ASK_DESCRIPTION' || step === 'CLARIFICATION') ? input.audioUrl : undefined;

    const context: FlowContext = {
      session,
      message: {
        phone: input.phone,
        text: input.text,
        imageUrls,
        audioUrl,
        location: input.location,
        buttonPayload: input.buttonPayload,
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

    console.log('[DEBUG] result.nextStep:', result.nextStep, '| session.currentFlow:', session.currentFlow);

    let updatedSession: BotSession;

    if (role === 'PROFESSIONAL' && _prsRequestId) {
      if (result.nextStep) {
        await this.botRepository.upsertRequestSession(input.phone, _prsRequestId, result.nextStep, finalTempData);
      } else {
        await this.botRepository.deleteRequestSession(_prsRequestId);
      }
      const remainingSessions = await this.botRepository.findActiveRequestSessions(input.phone);
      updatedSession = await this.botRepository.upsert(input.phone, {
        role,
        currentFlow: remainingSessions.length > 0 ? session.currentFlow : null,
        currentStep: null,
        tempData: {} as Prisma.InputJsonValue,
      });
    } else {
      if (role === 'USER' && !result.nextStep) {
        const oldTempData = (session.tempData as Record<string, unknown>) || {};
        const requestId = oldTempData.requestId as string | undefined;
        if (requestId) {
          await this.botRepository.deleteUserRequestSession(requestId);
        }
      }

      updatedSession = await this.botRepository.upsert(input.phone, {
        role,
        currentFlow: result.nextStep ? session.currentFlow : null,
        currentStep: result.nextStep || null,
        tempData: result.nextStep ? (finalTempData as Prisma.InputJsonValue) : ({} as Prisma.InputJsonValue),
      });

      if (role === 'USER' && result.nextStep) {
        const requestId = finalTempData.requestId as string | undefined;
        if (requestId) {
          const existingSession = await this.botRepository.findUserRequestSessionByRequestId(requestId);
          const existingData = (existingSession?.tempData as Record<string, unknown>) || {};

          await this.botRepository.upsertUserRequestSession(
            input.phone,
            requestId,
            result.nextStep,
            {
              ...finalTempData,
              categoryName: (finalTempData.categoryName as string) || existingData.categoryName,
              categoryId: (finalTempData.categoryId as string) || existingData.categoryId,
              geoNodeName: (finalTempData.geoNodeName as string) || existingData.geoNodeName,
              clientAddress: (finalTempData.clientAddress as string) || existingData.clientAddress,
            },
          );
        }
      }
    }

    if (pendingNotification) {
      console.log('[pendingNotification] targetPhone:', pendingNotification.targetPhone, 'step:', pendingNotification.step, 'tempData:', JSON.stringify(pendingNotification.tempData));

      const targetTempData: Record<string, unknown> = {
        ...pendingNotification.tempData,
        pendingMessage: pendingNotification.message,
        userId: pendingNotification.tempData.userId,
      };

      const targetRequestId = pendingNotification.tempData.requestId as string | undefined;
      const isProCoordination = pendingNotification.targetRole === 'PROFESSIONAL' &&
        pendingNotification.flow === 'COORDINATION' &&
        targetRequestId &&
        pendingNotification.step;

      if (isProCoordination) {
        await this.botRepository.upsertRequestSession(
          pendingNotification.targetPhone,
          targetRequestId!,
          pendingNotification.step!,
          targetTempData,
        );
        await this.botRepository.upsert(pendingNotification.targetPhone, {
          role: pendingNotification.targetRole,
          currentFlow: pendingNotification.flow,
          currentStep: null,
          tempData: {} as Prisma.InputJsonValue,
        });
      } else {
        await this.botRepository.upsert(pendingNotification.targetPhone, {
          role: pendingNotification.targetRole,
          currentFlow: pendingNotification.flow,
          currentStep: pendingNotification.step,
          tempData: targetTempData as Prisma.InputJsonValue,
        });
      }
    }

    if (role === 'USER' && result.response.requestId) {
      const sessionTempData = (session.tempData as Record<string, unknown>) || {};
      await this.botRepository.upsertUserRequestSession(
        input.phone,
        result.response.requestId,
        result.nextStep ?? null,
        {
          userId: sessionTempData.userId,
          phone: input.phone,
          requestId: result.response.requestId,
          categoryName: sessionTempData.categoryName,
          categoryId: sessionTempData.categoryId,
        },
      );
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

  private async resolveProfessionalState(
    phone: string,
    inputText?: string,
  ): Promise<{
    flowName: string | null;
    stepName: string | null;
    responseText: string;
    observationWarning?: string;
    requestId?: string;
    lastStatusMessageSentAt?: string;
  } | null> {
    const existing = await this.professionalsRepository.findByPhone(phone);
    if (!existing) return null;

    let responseText = '';
    let flowName: string | null = null;
    let stepName: string | null = null;
    let observationWarning: string | undefined;
    let requestId: string | undefined;
    let lastStatusMessageSentAt: string | undefined;

    const session = await this.botRepository.findByPhoneAndRole(phone, 'PROFESSIONAL');
    const tempData = (session?.tempData as Record<string, unknown>) || {};
    const existingLastSentAt = tempData.lastStatusMessageSentAt as string | undefined;

    const alreadySentToday = existingLastSentAt
      ? new Date(existingLastSentAt).toDateString() === new Date().toDateString()
      : false;

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
          responseText = `¡Hola ${existing.name}! Todavía tenés pendiente subir tu documentación. El enlace anterior venció, pero acá te mandamos uno nuevo: ${verificationUrl}`;
        } else {
          responseText = `¡Hola ${existing.name}! Todavía tenés pendiente subir tu documentación para verificar tu identidad. Podés hacerlo acá: ${verificationUrl}`;
        }
        break;
      }
      case ProfessionalStatus.UNDER_REVIEW:
        responseText = `¡Hola ${existing.name}! Ya tenemos tu documentación y la estamos revisando. En cuanto esté todo listo te avisamos por acá.`;
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

          const existingPRS = await this.botRepository.findRequestSessionByRequestId(activeRequest.id);
          if (!existingPRS) {
            await this.botRepository.upsertRequestSession(phone, activeRequest.id, stepName, {
              requestId: activeRequest.id,
            });
          }
        } else if (alreadySentToday) {
          const { callLLM } = await import('../../lib/llm-client');

          const llmPrompt = `Sos NORA, una asistente virtual de NORA Conecta, una plataforma que conecta usuarios con profesionales de servicios del hogar en Argentina (plomeros, electricistas, gasistas, etc.).

Estás hablando con ${existing.name}, un profesional registrado en la plataforma. Su cuenta está activa y puede recibir pedidos.

El profesional te escribió: "${inputText || ''}"

Respondé de forma breve, natural y en español rioplatense (usá "vos", "te", etc.). Solo respondé preguntas relacionadas con NORA Conecta, el panel del profesional, los pedidos, o cómo funciona la plataforma. Si la pregunta no tiene nada que ver con NORA, respondé amablemente que solo podés ayudar con temas relacionados a la plataforma.

No uses saludos largos. Máximo 2-3 oraciones. No inventes funcionalidades que no existen.

Contexto de NORA para responder preguntas:
- Los pedidos llegan automáticamente por WhatsApp cuando un usuario necesita el servicio del profesional
- El profesional puede ver y gestionar sus pedidos desde su panel web
- La calificación del profesional determina cuántos pedidos recibe
- Para acceder al panel, el profesional puede escribir "panel" o "link"`;

          responseText = await callLLM(llmPrompt);
          lastStatusMessageSentAt = existingLastSentAt;
        } else {
          responseText = `¡Hola ${existing.name}! ¿En qué te puedo ayudar?`;
          lastStatusMessageSentAt = new Date().toISOString();
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

          const existingPRS = await this.botRepository.findRequestSessionByRequestId(activeRequest.id);
          if (!existingPRS) {
            await this.botRepository.upsertRequestSession(phone, activeRequest.id, stepName, {
              requestId: activeRequest.id,
            });
          }
        } else if (alreadySentToday) {
          const { callLLM } = await import('../../lib/llm-client');

          const llmPrompt = `Sos NORA, una asistente virtual de NORA Conecta, una plataforma que conecta usuarios con profesionales de servicios del hogar en Argentina (plomeros, electricistas, gasistas, etc.).

Estás hablando con ${existing.name}, un profesional registrado en la plataforma. Su cuenta está activa y puede recibir pedidos.

El profesional te escribió: "${inputText || ''}"

Respondé de forma breve, natural y en español rioplatense (usá "vos", "te", etc.). Solo respondé preguntas relacionadas con NORA Conecta, el panel del profesional, los pedidos, o cómo funciona la plataforma. Si la pregunta no tiene nada que ver con NORA, respondé amablemente que solo podés ayudar con temas relacionados a la plataforma.

No uses saludos largos. Máximo 2-3 oraciones. No inventes funcionalidades que no existen.

Contexto de NORA para responder preguntas:
- Los pedidos llegan automáticamente por WhatsApp cuando un usuario necesita el servicio del profesional
- El profesional puede ver y gestionar sus pedidos desde su panel web
- La calificación del profesional determina cuántos pedidos recibe
- Para acceder al panel, el profesional puede escribir "panel" o "link"`;

          responseText = await callLLM(llmPrompt);
          lastStatusMessageSentAt = existingLastSentAt;
          observationWarning = undefined;
        } else {
          responseText = `¡Hola ${existing.name}! ¿En qué te puedo ayudar?`;
          lastStatusMessageSentAt = new Date().toISOString();
          observationWarning = undefined;
        }
        break;
      }
      case ProfessionalStatus.PAUSED:
        responseText = `¡Hola ${existing.name}! Tu cuenta está pausada. Cuando quieras volver a recibir pedidos, escribinos a contacto@noraconecta.com`;
        break;
      case ProfessionalStatus.SUSPENDED:
        responseText = `Hola ${existing.name}. Tu cuenta está suspendida en este momento. Si creés que es un error o querés saber más, escribinos a contacto@noraconecta.com`;
        break;
      case ProfessionalStatus.REJECTED:
        responseText = `Hola ${existing.name}. Lamentablemente tu solicitud no fue aprobada. Si tenés dudas o querés saber el motivo, escribinos a contacto@noraconecta.com`;
        break;
    }

    return {
      flowName,
      stepName,
      responseText,
      observationWarning,
      requestId,
      lastStatusMessageSentAt,
    };
  }
}
