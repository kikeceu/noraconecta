import { FlowContext, FlowHandler, FlowStepResult, SavedLocation } from './types';
import prisma from '../../../lib/prisma';
import { parseDateTimeNatural, getDayArgentina, getHoursArgentina, getMinutesArgentina, formatDateTimeArgentina } from '../../../utils/date-utils';
import { RequestsService } from '../../requests/requests.service';
import { RequestsRepository } from '../../requests/requests.repository';
import { MatchingRepository } from '../../matching/matching.repository';
import { UsersRepository } from '../../users/users.repository';
import { BotRepository } from '../../bot/bot.repository';
import { CoordinationService } from '../coordination.service';
import { ConfigRepository } from '../../config/config.repository';
import { AbuseDetectionService } from '../abuse-detection.service';
import { NotificationService } from '../../notifications/notification.service';
import { handleCancelConfirmation } from './cancel-flow.helper';
import { resolveOptionWithFallback, generateOffTopicResponse } from './option-resolver.helper';
import { BOT_PAYLOADS } from '../constants/bot-payloads';
import { upsertSavedLocationByAddress, findLocationsByGeoNode, touchSavedLocation, DEFAULT_MAX_SAVED_LOCATIONS } from './location-saver.helper';

const MAX_NEGOTIATION_ROUNDS = 3;

export class CoordinationFlow implements FlowHandler {
  readonly flowName = 'COORDINATION';

  constructor(
    private readonly requestsService: RequestsService,
    private readonly coordinationService: CoordinationService,
    private readonly usersRepository: UsersRepository,
    private readonly configRepository: ConfigRepository,
    private readonly notificationService?: NotificationService,
  ) {}

  getInitialStep(): string {
    return 'AWAITING_AVAILABILITY';
  }

  async handleStep(step: string, context: FlowContext): Promise<FlowStepResult> {
    const { session, message } = context;
    const tempData = (session.tempData as Record<string, unknown>) || {};
    const role = session.role as 'USER' | 'PROFESSIONAL';

    switch (step) {
      case 'AWAITING_ACCEPTANCE':
        return this.handleAwaitingAcceptance(message, tempData, role);
      case 'AWAITING_AVAILABILITY':
        return this.handleAwaitingAvailability(message, tempData, role);
      case 'AWAITING_CONFIRMATION':
        return this.handleAwaitingConfirmation(message, tempData, role);
      case 'CONFIRM_AVAILABILITY':
        return this.handleConfirmAvailability(message, tempData, role);
      case 'CONFIRM_PRO_AVAILABILITY':
        return this.handleConfirmProAvailability(message, tempData, role);
      case 'AWAITING_USER_CONFIRMATION':
        return this.handleAwaitingUserConfirmation(message, tempData, role);
      case 'AWAITING_VISIT_CONFIRMATION':
        return this.handleAwaitingVisitConfirmation(message, tempData, role);
      case 'AWAITING_GPS':
        return this.handleAwaitingGps(message, tempData, role);
      case 'AWAITING_LOCATION':
        return this.handleAwaitingLocation(message, tempData, role);
      case 'AWAITING_VISIT':
        return this.handleAwaitingVisit(message, tempData, role);
      case 'CANCEL_CONFIRMATION':
        return handleCancelConfirmation(context, this.requestsService, this.notificationService);
      default:
        return this.handleAwaitingAvailability(message, tempData, role);
    }
  }

  private async handleAwaitingAcceptance(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    const requestId = tempData.requestId as string;

    if (!requestId) {
      return {
        response: { text: 'No encontré un pedido asignado para responder.' },
        nextStep: null,
        tempData: { _clearTempData: true },
      };
    }

    if (role !== 'PROFESSIONAL') {
      return {
        response: { text: 'Esperando la respuesta del profesional asignado.' },
        nextStep: 'AWAITING_ACCEPTANCE',
        tempData,
      };
    }

    const inputText = message.text?.trim().toLowerCase() || '';
    const detailsShown = tempData._detailsShown as boolean;

    // Second exchange: after details are shown, interpret '1' as ACCEPT
    if (detailsShown) {
      const acceptAliases = ['1', 'aceptar', 'acepto', 'si', 'sí', 'dale', 'ok'];
      if (acceptAliases.includes(inputText)) {
        try {
          await this.requestsService.accept(requestId);

          return {
            response: {
              text: '¡Perfecto! Aceptaste el pedido. El usuario va a coordinar la visita por acá.',
            },
            nextStep: null,
            tempData: { _clearTempData: true },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'No se pudo aceptar el pedido.';

          return {
            response: { text: errorMessage },
            nextStep: null,
            tempData: { _clearTempData: true },
          };
        }
      }
      // REJECT falls through to the resolver below
    }

    if (['1', 'ver detalles', 'detalle', 'detalles', 'ver pedido', BOT_PAYLOADS.VER_DETALLES].includes(inputText)) {
      let categoryName = tempData.categoryName as string | undefined;
      let zoneName = tempData.zoneName as string | undefined;
      let description = tempData.description as string | undefined;
      let photoUrls = (tempData.photoUrls as string[] | undefined) || [];
      let audioUrl = tempData.audioUrl as string | undefined;

      if (!categoryName || !zoneName || !description) {
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
          return {
            response: { text: 'No encontré los detalles del pedido asignado.' },
            nextStep: null,
            tempData: { _clearTempData: true },
          };
        }

        categoryName = request.category?.name || 'el servicio';
        zoneName = request.geoNode?.name || 'tu zona';
        description = request.description;
        photoUrls = request.photoUrls;
        audioUrl = request.audioUrl || undefined;
      }

      const hasMedia = (photoUrls && photoUrls.length > 0) || !!audioUrl;

      if (!hasMedia) {
        return {
          response: {
            text: `Pedido de ${categoryName} en ${zoneName}.\n\nDescripción: ${description}\n\n1. Aceptar\n2. Ahora no puedo`,
          },
          nextStep: 'AWAITING_ACCEPTANCE',
          tempData: {
            ...tempData,
            _detailsShown: true,
            categoryName,
            zoneName,
            description,
          },
        };
      }

      const detailsResponse: FlowStepResult = {
        response: {
          text: [
            `Pedido de ${categoryName} en ${zoneName}.`,
            `Descripción: ${description}`,
            '1. Aceptar\n2. Rechazar',
          ].join('\n\n'),
          mediaUrls: photoUrls,
          audioUrl,
          mediaFirst: true,
        },
        nextStep: 'AWAITING_ACCEPTANCE',
        tempData: {
          ...tempData,
          _detailsShown: true,
          categoryName,
          zoneName,
          description,
          photoUrls,
          audioUrl,
        },
      };

      return detailsResponse;
    }

    const resolved = await resolveOptionWithFallback('AWAITING_ACCEPTANCE', inputText);

    if (resolved === 'VER_DETALLES') {
      let detailCategoryName = tempData.categoryName as string | undefined;
      let detailZoneName = tempData.zoneName as string | undefined;
      let detailDescription = tempData.description as string | undefined;
      let detailPhotoUrls = (tempData.photoUrls as string[] | undefined) || [];
      let detailAudioUrl = tempData.audioUrl as string | undefined;

      if (!detailCategoryName || !detailZoneName || !detailDescription) {
        const fetchedRequest = await prisma.request.findUnique({
          where: { id: requestId },
          select: {
            category: { select: { name: true } },
            geoNode: { select: { name: true } },
            description: true,
            photoUrls: true,
            audioUrl: true,
          },
        });

        if (!fetchedRequest) {
          return {
            response: { text: 'No encontré los detalles del pedido asignado.' },
            nextStep: null,
            tempData: { _clearTempData: true },
          };
        }

        detailCategoryName = fetchedRequest.category?.name || 'el servicio';
        detailZoneName = fetchedRequest.geoNode?.name || 'tu zona';
        detailDescription = fetchedRequest.description;
        detailPhotoUrls = fetchedRequest.photoUrls;
        detailAudioUrl = fetchedRequest.audioUrl || undefined;
      }

      const detailHasMedia = (detailPhotoUrls && detailPhotoUrls.length > 0) || !!detailAudioUrl;

      if (!detailHasMedia) {
        return {
          response: {
            text: `Pedido de ${detailCategoryName} en ${detailZoneName}.\n\nDescripción: ${detailDescription}\n\n1. Aceptar\n2. Ahora no puedo`,
          },
          nextStep: 'AWAITING_ACCEPTANCE',
          tempData: {
            ...tempData,
            _detailsShown: true,
            categoryName: detailCategoryName,
            zoneName: detailZoneName,
            description: detailDescription,
          },
        };
      }

      const verDetallesResponse: FlowStepResult = {
        response: {
          text: [
            `Pedido de ${detailCategoryName} en ${detailZoneName}.`,
            `Descripción: ${detailDescription}`,
            '1. Aceptar\n2. Rechazar',
          ].join('\n\n'),
          mediaUrls: detailPhotoUrls,
          audioUrl: detailAudioUrl,
          mediaFirst: true,
        },
        nextStep: 'AWAITING_ACCEPTANCE',
        tempData: {
          ...tempData,
          _detailsShown: true,
          categoryName: detailCategoryName,
          zoneName: detailZoneName,
          description: detailDescription,
          photoUrls: detailPhotoUrls,
          audioUrl: detailAudioUrl,
        },
      };

      return verDetallesResponse;
    }

    if (resolved === 'ACCEPT') {
      try {
        await this.requestsService.accept(requestId);

        return {
          response: {
            text: '¡Perfecto! Aceptaste el pedido. El usuario va a coordinar la visita por acá.',
          },
          nextStep: null,
          tempData: { _clearTempData: true },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'No se pudo aceptar el pedido.';

        return {
          response: { text: errorMessage },
          nextStep: null,
          tempData: { _clearTempData: true },
        };
      }
    }

    if (resolved === 'REJECT') {
      try {
        await this.requestsService.reject(requestId);

        const req = await prisma.request.findUnique({
          where: { id: requestId },
          select: { assignedProfessionalId: true },
        });
        const professionalId = req?.assignedProfessionalId;

        let responseText = 'Entendido. Rechazaste el pedido.';

        if (professionalId) {
          const abuseDetection = new AbuseDetectionService();
          const abuseLevel = await abuseDetection.checkProfessionalAbuse(professionalId);

          if (abuseLevel === 'warn') {
            await prisma.professional.update({
              where: { id: professionalId },
              data: { abuseWarningCount: { increment: 1 } },
            });
            responseText += '\n\n⚠️ Notamos varias cancelaciones de tu parte. Esto afecta la experiencia de los usuarios. Si esto continúa, tu cuenta podría ser suspendida.';
          }

          if (abuseLevel === 'suspend') {
            await prisma.professional.update({
              where: { id: professionalId },
              data: { status: 'SUSPENDED' },
            });
          }
        }

        return {
          response: {
            text: responseText,
          },
          nextStep: null,
          tempData: { _clearTempData: true },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'No se pudo rechazar el pedido.';

        return {
          response: { text: errorMessage },
          nextStep: null,
          tempData: { _clearTempData: true },
        };
      }
    }

    if (!resolved) {
      const stepContext = `Se le mostró al profesional un pedido y se le pidió que responda con una opción: 1. Ver detalles, 2. Rechazar (o "aceptar" si ya vio los detalles).`;
      const offTopic = await generateOffTopicResponse(inputText, stepContext);
      if (offTopic) {
        return {
          response: { text: offTopic },
          nextStep: 'AWAITING_ACCEPTANCE',
          tempData,
        };
      }
    }

    return {
      response: {
        text: 'Respondé con una opción:\n\n1. Ver detalles\n2. Rechazar',
      },
      nextStep: 'AWAITING_ACCEPTANCE',
      tempData,
    };
  }

  private async handleAwaitingAvailability(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    const requestId = tempData.requestId as string;
    const negotiationRounds = (tempData.negotiationRounds as number) || 0;
    const alreadySent = tempData._sent as boolean;

    if (role === 'USER' && message.text?.trim()) {
      if (alreadySent) {
        const request = await prisma.request.findUnique({
          where: { id: requestId },
          select: {
            assignedProfessional: { select: { name: true } },
          },
        });
        const professionalName = request?.assignedProfessional?.name || 'El profesional';
        return {
          response: {
            text: `Ya le avisé a ${professionalName}. Esperá su confirmación.`,
          },
          nextStep: 'AWAITING_AVAILABILITY',
          tempData,
        };
      }

      const availability = message.text.trim();
      const now = new Date();
      const result = await parseDateTimeNatural(availability, now);

      if (!result.success) {
        const errorText = result.reason === 'past'
          ? 'La fecha que indicaste ya pasó. Indicá una fecha futura. Por ejemplo: *viernes 13/06 a las 16:00*'
          : 'No pude interpretar la fecha y hora. Indicá ambos datos. Por ejemplo: *viernes 13/06 a las 16:00*';

        return {
          response: {
            text: errorText,
          },
          nextStep: 'AWAITING_AVAILABILITY',
          tempData: { ...tempData, negotiationRounds },
        };
      }

      const parsedDate = result.date;
      const formattedDate = formatDateTimeArgentina(parsedDate);
      return {
        response: {
          text: `Entendido, ¿confirmás el *${formattedDate}*?\n1. Sí\n2. No, corregir`,
        },
        nextStep: 'CONFIRM_AVAILABILITY',
        tempData: {
          ...tempData,
          parsedScheduledAt: parsedDate.toISOString(),
          availability,
          negotiationRounds,
        },
      };
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        user: { select: { name: true } },
        assignedProfessional: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    if (!request) {
      return {
        response: { text: 'Error interno: pedido no encontrado.' },
        nextStep: null,
        tempData: { _clearTempData: true },
      };
    }

    const professionalName = request.assignedProfessional?.name || 'El profesional';
    const categoryName = request.category?.name || 'el servicio';

    const messageText = negotiationRounds > 0
      ? `¿Qué otro día y horario tenés disponible para la visita de ${professionalName} (${categoryName})? Si necesitás cancelar, escribí "cancelar".`
      : `¡Buenas noticias! ${professionalName} aceptó tu pedido de ${categoryName}. 🎉 ¿Qué día y horario te viene bien para la visita? Si necesitás cancelar, escribí "cancelar".`;

    return {
      response: {
        text: messageText,
      },
      nextStep: 'AWAITING_AVAILABILITY',
      tempData: { ...tempData, negotiationRounds },
    };
  }

  private async handleConfirmAvailability(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'USER') {
      return {
        response: { text: 'Esperando confirmación del usuario.' },
        nextStep: 'CONFIRM_AVAILABILITY',
        tempData,
      };
    }

    const inputText = message.text?.trim().toLowerCase() || '';
    const resolved = await resolveOptionWithFallback('CONFIRM_AVAILABILITY', inputText);

    if (resolved === 'YES') {
      const parsedDate = new Date(tempData.parsedScheduledAt as string);
      const requestId = tempData.requestId as string;
      const negotiationRounds = (tempData.negotiationRounds as number) || 0;
      const availability = tempData.availability as string;

      const assignedRequest = await prisma.request.findUnique({
        where: { id: requestId },
        select: { assignedProfessionalId: true },
      });
      const professionalId = assignedRequest?.assignedProfessionalId;

      if (professionalId) {
        const requestsRepo = new RequestsRepository();
        const hasConflict = await requestsRepo.findConflictingSchedule(
          professionalId,
          parsedDate,
          requestId,
        );

        if (hasConflict) {
          return {
            response: {
              text: 'Ese horario no está disponible para el profesional. Indicá otro día y hora. Por ejemplo: *viernes 13/06 a las 16:00*',
            },
            nextStep: 'AWAITING_AVAILABILITY',
            tempData: { ...tempData, negotiationRounds },
          };
        }
      }

      const request = await prisma.request.update({
        where: { id: requestId },
        data: {
          coordinationStatus: 'AWAITING_CONFIRMATION',
          clientAvailability: formatDateTimeArgentina(parsedDate),
          scheduledAt: parsedDate,
        },
        include: {
          user: { select: { name: true, phone: true } },
          assignedProfessional: { select: { name: true, phone: true } },
          category: { select: { name: true } },
        },
      });

      const professionalName = request.assignedProfessional?.name || 'El profesional';
      const formattedDate = formatDateTimeArgentina(parsedDate);

      const professionalMessage = `Tu cliente ${request.user?.name || 'el usuario'} puede el ${formattedDate}. ¿Confirmás?\n1. Sí\n2. Proponer otro horario`;

      return {
        response: {
          text: `Le aviso a ${professionalName} que podés el ${formattedDate}. Esperá su confirmación.`,
        },
        nextStep: 'AWAITING_AVAILABILITY',
        tempData: {
          requestId,
          availability,
          scheduledAt: parsedDate.toISOString(),
          negotiationRounds,
          _sent: true,
          pendingNotification: {
            targetPhone: request.assignedProfessional?.phone,
            targetRole: 'PROFESSIONAL',
            message: professionalMessage,
            flow: 'COORDINATION',
            step: 'AWAITING_CONFIRMATION',
            tempData: {
              requestId,
              userId: request.userId,
              userName: request.user?.name,
              userPhone: request.user?.phone,
              professionalId: request.assignedProfessionalId,
              professionalName,
              professionalPhone: request.assignedProfessional?.phone,
              availability,
              scheduledAt: parsedDate.toISOString(),
              negotiationRounds,
              categoryName: request.category?.name,
              description: request.description,
            },
          },
        } as Record<string, unknown>,
      };
    }

    if (resolved === null) {
      const parsedDateStr = tempData.parsedScheduledAt as string;
      let formattedDate = 'esa fecha';
      if (parsedDateStr) {
        formattedDate = formatDateTimeArgentina(new Date(parsedDateStr));
      }
      const stepContext = `Se le preguntó al usuario si confirma el ${formattedDate} para la visita del profesional. Opciones: 1. Sí, 2. No, corregir.`;
      const offTopic = await generateOffTopicResponse(inputText, stepContext);
      if (offTopic) {
        return {
          response: { text: offTopic },
          nextStep: 'CONFIRM_AVAILABILITY',
          tempData,
        };
      }
    }

    return {
      response: {
        text: 'Indicá el día y la hora. Por ejemplo: *viernes 13/06 a las 16:00*',
      },
      nextStep: 'AWAITING_AVAILABILITY',
      tempData: {
        ...tempData,
        parsedScheduledAt: undefined,
      },
    };
  }

  private async handleAwaitingConfirmation(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    const requestId = tempData.requestId as string;

    if (role === 'PROFESSIONAL' && message.text?.trim()) {
      const scheduleText = message.text.trim();

      if (tempData._proposingAlternative) {
        const now = new Date();
        const result = await parseDateTimeNatural(scheduleText, now);

        if (!result.success) {
          const errorText = result.reason === 'past'
            ? 'La fecha que indicaste ya pasó. Indicá una fecha futura. Por ejemplo: *viernes 13/06 a las 16:00*'
            : 'No pude interpretar la fecha y hora. Indicá ambos datos. Por ejemplo: *viernes 13/06 a las 16:00*';

          return {
            response: { text: errorText },
            nextStep: 'AWAITING_CONFIRMATION',
            tempData,
          };
        }

        const newScheduledAt = result.date;
        const alternativeText = formatDateTimeArgentina(newScheduledAt);
        return {
          response: {
            text: `Entendido, ¿confirmás proponer el *${alternativeText}*?\n1. Sí\n2. No, corregir`,
          },
          nextStep: 'CONFIRM_PRO_AVAILABILITY',
          tempData: {
            ...tempData,
            _proposingAlternative: undefined,
            parsedAlternativeScheduledAt: newScheduledAt.toISOString(),
          },
        };
      }

      const resolved = await resolveOptionWithFallback('AWAITING_CONFIRMATION', scheduleText);

      if (resolved === 'CONFIRM') {
        const existingScheduledAt = tempData.scheduledAt as string;
        const scheduledAt = new Date(existingScheduledAt);

        await prisma.request.update({
          where: { id: requestId },
          data: {
            coordinationStatus: 'AWAITING_LOCATION',
          },
        });

        const userName = tempData.userName as string;
        const professionalName = tempData.professionalName as string;

        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const dayName = dayNames[getDayArgentina(scheduledAt)];
        const hours = getHoursArgentina(scheduledAt).toString().padStart(2, '0');
        const minutes = getMinutesArgentina(scheduledAt).toString().padStart(2, '0');

        const existingRequest = await prisma.request.findUnique({
          where: { id: requestId },
          select: { clientAddress: true },
        });

        if (existingRequest?.clientAddress) {
          const finalizeResult = await this.finalizeLocation(existingRequest.clientAddress, requestId, {
            ...tempData,
            professionalName,
          });

          return {
            response: {
              text: `Horario confirmado para el ${dayName} a las ${hours}:${minutes}. Le aviso a ${userName}.`,
            },
            nextStep: null,
            tempData: {
              requestId,
              scheduledAt: existingScheduledAt,
              pendingNotification: {
                targetPhone: tempData.userPhone,
                targetRole: 'USER',
                message: finalizeResult.response.text,
                flow: 'COORDINATION',
                step: finalizeResult.nextStep,
                tempData: finalizeResult.tempData,
              },
            } as Record<string, unknown>,
          };
        }

        const requestForGps = await prisma.request.findUnique({
          where: { id: requestId },
          select: { userLatitude: true, geoNode: { select: { name: true } } },
        });

        const needsGps = !requestForGps?.userLatitude;
        const zoneName = requestForGps?.geoNode?.name || 'tu zona';

        const userMessage = needsGps
          ? `Para que ${professionalName} pueda encontrarte fácilmente en ${zoneName}, compartí tu ubicación por WhatsApp. Si no querés compartirla, escribí "no".`
          : `${professionalName} confirmó la visita para el ${dayName} a las ${hours}:${minutes}. Por favor, indicá la dirección exacta donde realizarás el trabajo (calle, número, piso, depto, referencia o número de manzana si es barrio privado).`;

        const targetStep = needsGps ? 'AWAITING_GPS' : 'AWAITING_LOCATION';

        return {
          response: {
            text: `Horario confirmado para el ${dayName} a las ${hours}:${minutes}. Le aviso a ${userName}.`,
          },
          nextStep: null,
          tempData: {
            requestId,
            scheduledAt: existingScheduledAt,
            pendingNotification: {
              targetPhone: tempData.userPhone,
              targetRole: 'USER',
              message: userMessage,
              flow: 'COORDINATION',
              step: targetStep,
              tempData: {
                requestId,
                userId: tempData.userId,
                userName,
                userPhone: tempData.userPhone,
                professionalId: tempData.professionalId,
                professionalName,
                professionalPhone: tempData.professionalPhone,
                categoryName: tempData.categoryName,
                description: tempData.description,
                scheduledAt: existingScheduledAt,
              },
            },
          } as Record<string, unknown>,
        };
      }

      if (resolved === 'PROPOSE_ALTERNATIVE') {
        return {
          response: {
            text: 'Indicá el día y la hora que te viene bien. Por ejemplo: *viernes 13/06 a las 16:00*',
          },
          nextStep: 'AWAITING_CONFIRMATION',
          tempData: {
            ...tempData,
            _proposingAlternative: true,
          },
        };
      }

      if (!resolved) {
        const userName = (tempData.userName as string) || 'el usuario';
        const scheduledAtStr = tempData.scheduledAt as string | undefined;
        let formattedDate = 'ese horario';
        if (scheduledAtStr) {
          formattedDate = formatDateTimeArgentina(new Date(scheduledAtStr));
        }
        const stepContext = `Se le pidió al profesional que confirme si puede atender a ${userName} el ${formattedDate}. Opciones: 1. Sí (confirmar), 2. Proponer otro horario.`;
        const offTopic = await generateOffTopicResponse(scheduleText, stepContext);
        if (offTopic) {
          return {
            response: { text: offTopic },
            nextStep: 'AWAITING_CONFIRMATION',
            tempData,
          };
        }
      }

      const now = new Date();
      const result = await parseDateTimeNatural(scheduleText, now);

      if (!result.success) {
        const errorText = result.reason === 'past'
          ? 'La fecha que indicaste ya pasó. Indicá una fecha futura. Por ejemplo: *viernes 13/06 a las 16:00*'
          : 'No pude interpretar la fecha y hora. Indicá ambos datos. Por ejemplo: *viernes 13/06 a las 16:00*';

        return {
          response: {
            text: errorText,
          },
          nextStep: 'AWAITING_CONFIRMATION',
          tempData,
        };
      }

      const newScheduledAt = result.date;
      const alternativeText = formatDateTimeArgentina(newScheduledAt);
      return {
        response: {
          text: `Entendido, ¿confirmás proponer el *${alternativeText}*?\n1. Sí\n2. No, corregir`,
        },
        nextStep: 'CONFIRM_PRO_AVAILABILITY',
        tempData: {
          ...tempData,
          parsedAlternativeScheduledAt: newScheduledAt.toISOString(),
        },
      };
    }

    const userName = (tempData.userName as string) || 'el usuario';
    const scheduledAtStr = tempData.scheduledAt as string | undefined;

    let formattedDate = 'ese horario';
    if (scheduledAtStr) {
      const parsed = new Date(scheduledAtStr);
      formattedDate = formatDateTimeArgentina(parsed);
    }

    return {
      response: {
        text: `Tu cliente ${userName} puede el ${formattedDate}. ¿Confirmás?\n1. Sí\n2. Proponer otro horario`,
      },
      nextStep: 'AWAITING_CONFIRMATION',
      tempData,
    };
  }

  private async handleConfirmProAvailability(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'PROFESSIONAL') {
      return {
        response: { text: 'Esperando confirmación del profesional.' },
        nextStep: 'CONFIRM_PRO_AVAILABILITY',
        tempData,
      };
    }

    const inputText = message.text?.trim().toLowerCase() || '';
    const resolved = await resolveOptionWithFallback('CONFIRM_PRO_AVAILABILITY', inputText);

    if (resolved !== 'YES') {
      if (resolved === null) {
        const parsedDateStr = tempData.parsedAlternativeScheduledAt as string;
        let formattedDate = 'esa fecha';
        if (parsedDateStr) {
          formattedDate = formatDateTimeArgentina(new Date(parsedDateStr));
        }
        const stepContext = `Se le preguntó al profesional si confirma proponer el ${formattedDate} como alternativa. Opciones: 1. Sí, 2. No, corregir.`;
        const offTopic = await generateOffTopicResponse(inputText, stepContext);
        if (offTopic) {
          return {
            response: { text: offTopic },
            nextStep: 'CONFIRM_PRO_AVAILABILITY',
            tempData,
          };
        }
      }

      return {
        response: {
          text: 'Indicá el día y la hora. Por ejemplo: *viernes 13/06 a las 16:00*',
        },
        nextStep: 'AWAITING_CONFIRMATION',
        tempData: {
          ...tempData,
          parsedAlternativeScheduledAt: undefined,
        },
      };
    }

    const requestId = tempData.requestId as string;
    const newScheduledAt = new Date(tempData.parsedAlternativeScheduledAt as string);

    const professionalId = tempData.professionalId as string;

    if (professionalId) {
      const requestsRepo = new RequestsRepository();
      const hasConflict = await requestsRepo.findConflictingSchedule(
        professionalId,
        newScheduledAt,
        requestId,
      );

      if (hasConflict) {
        return {
          response: {
            text: 'Ya tenés una visita confirmada en ese día y hora. Indicá otro horario. Por ejemplo: *viernes 13/06 a las 16:00*',
          },
          nextStep: 'AWAITING_CONFIRMATION',
          tempData: {
            ...tempData,
            parsedAlternativeScheduledAt: undefined,
          },
        };
      }
    }

    const existingScheduledAt = tempData.scheduledAt as string | undefined;
    const existingDate = existingScheduledAt ? new Date(existingScheduledAt) : null;

    if (existingDate && this.isSameSchedule(newScheduledAt, existingDate)) {
      await prisma.request.update({
        where: { id: requestId },
        data: {
          coordinationStatus: 'AWAITING_LOCATION',
          clientAvailability: formatDateTimeArgentina(newScheduledAt),
          scheduledAt: newScheduledAt,
        },
      });

      const userName = tempData.userName as string;
      const professionalName = tempData.professionalName as string;

      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const dayName = dayNames[getDayArgentina(newScheduledAt)];
      const hours = getHoursArgentina(newScheduledAt).toString().padStart(2, '0');
      const minutes = getMinutesArgentina(newScheduledAt).toString().padStart(2, '0');

      const existingRequest = await prisma.request.findUnique({
        where: { id: requestId },
        select: { clientAddress: true },
      });

      if (existingRequest?.clientAddress) {
        const finalizeResult = await this.finalizeLocation(existingRequest.clientAddress, requestId, {
          ...tempData,
          professionalName,
        });

        return {
          response: {
            text: `Horario confirmado para el ${dayName} a las ${hours}:${minutes}. Le aviso a ${userName}.`,
          },
          nextStep: null,
          tempData: {
            requestId,
            scheduledAt: newScheduledAt.toISOString(),
            pendingNotification: {
              targetPhone: tempData.userPhone,
              targetRole: 'USER',
              message: finalizeResult.response.text,
              flow: 'COORDINATION',
              step: finalizeResult.nextStep,
              tempData: finalizeResult.tempData,
            },
          } as Record<string, unknown>,
        };
      }

      const requestForGps = await prisma.request.findUnique({
        where: { id: requestId },
        select: { userLatitude: true, geoNode: { select: { name: true } } },
      });

      const needsGps = !requestForGps?.userLatitude;
      const zoneName = requestForGps?.geoNode?.name || 'tu zona';

      const userMessage = needsGps
        ? `Para que ${professionalName} pueda encontrarte fácilmente en ${zoneName}, compartí tu ubicación por WhatsApp. Si no querés compartirla, escribí "no".`
        : `${professionalName} confirmó la visita para el ${dayName} a las ${hours}:${minutes}. Por favor, indicá la dirección exacta donde realizarás el trabajo (calle, número, piso, depto, referencia o número de manzana si es barrio privado).`;

      const targetStep = needsGps ? 'AWAITING_GPS' : 'AWAITING_LOCATION';

      return {
        response: {
          text: `Horario confirmado para el ${dayName} a las ${hours}:${minutes}. Le aviso a ${userName}.`,
        },
        nextStep: null,
        tempData: {
          requestId,
          scheduledAt: newScheduledAt.toISOString(),
          pendingNotification: {
            targetPhone: tempData.userPhone,
            targetRole: 'USER',
            message: userMessage,
            flow: 'COORDINATION',
            step: targetStep,
            tempData: {
              requestId,
              userId: tempData.userId,
              userName,
              userPhone: tempData.userPhone,
              professionalId: tempData.professionalId,
              professionalName,
              professionalPhone: tempData.professionalPhone,
              categoryName: tempData.categoryName,
              description: tempData.description,
              scheduledAt: newScheduledAt.toISOString(),
            },
          },
        } as Record<string, unknown>,
      };
    }

    await prisma.request.update({
      where: { id: requestId },
      data: {
        coordinationStatus: 'AWAITING_USER_CONFIRMATION',
        clientAvailability: formatDateTimeArgentina(newScheduledAt),
        scheduledAt: newScheduledAt,
      },
    });

    const userName = tempData.userName as string;
    const professionalName = tempData.professionalName as string;

    const alternativeText = formatDateTimeArgentina(newScheduledAt);

    const userMessage = `${professionalName} propone el ${alternativeText}. ¿Te viene bien?\n1. Sí, perfecto\n2. No me viene bien`;

    return {
      response: {
        text: `Le aviso a ${userName} que proponés el ${alternativeText}.`,
      },
      nextStep: null,
      tempData: {
        requestId,
        alternativeScheduledAt: newScheduledAt.toISOString(),
        scheduledAt: existingScheduledAt,
        pendingNotification: {
          targetPhone: tempData.userPhone,
          targetRole: 'USER',
          message: userMessage,
          flow: 'COORDINATION',
          step: 'AWAITING_USER_CONFIRMATION',
          tempData: {
            requestId,
            userId: tempData.userId,
            userName,
            userPhone: tempData.userPhone,
            professionalId: tempData.professionalId,
            professionalName,
            professionalPhone: tempData.professionalPhone,
            categoryName: tempData.categoryName,
            description: tempData.description,
            alternativeScheduledAt: newScheduledAt.toISOString(),
            negotiationRounds: tempData.negotiationRounds,
          },
        },
      } as Record<string, unknown>,
    };
  }

  private async handleAwaitingUserConfirmation(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    const requestId = tempData.requestId as string;

    if (role === 'USER' && message.text?.trim()) {
      const response = message.text.trim().toLowerCase();

      const resolved = await resolveOptionWithFallback('AWAITING_USER_CONFIRMATION', response);

      if (resolved === 'YES') {
        const alternativeScheduledAt = new Date(tempData.alternativeScheduledAt as string);
        const professionalName = (tempData.professionalName as string) || 'El profesional';
        const userName = (tempData.userName as string) || 'el usuario';

        await prisma.request.update({
          where: { id: requestId },
          data: {
            coordinationStatus: 'SCHEDULED',
            scheduledAt: alternativeScheduledAt,
          },
        });

        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const dayName = dayNames[getDayArgentina(alternativeScheduledAt)];
        const hours = getHoursArgentina(alternativeScheduledAt).toString().padStart(2, '0');
        const minutes = getMinutesArgentina(alternativeScheduledAt).toString().padStart(2, '0');

        this.coordinationService.notifyProfessionalClientAcceptedSchedule(
          tempData.professionalPhone as string,
          userName,
          dayName,
          hours,
          minutes,
        ).catch((err) => {
          console.error('[CoordinationFlow] Failed to notify professional client accepted:', err);
        });

        const userMessage = `¡Buenísimo! Le confirmo a ${professionalName} la visita para el ${dayName} a las ${hours}:${minutes}.\n\nPor favor, indicá la dirección exacta donde realizarás el trabajo (calle, número, piso, depto, referencia o número de manzana si es barrio privado).`;

        return {
          response: {
            text: userMessage,
          },
          nextStep: 'AWAITING_LOCATION',
          tempData: {
            requestId,
            scheduledAt: alternativeScheduledAt.toISOString(),
            userId: tempData.userId,
            userName: tempData.userName,
            userPhone: tempData.userPhone,
            professionalId: tempData.professionalId,
            professionalName,
            professionalPhone: tempData.professionalPhone,
            categoryName: tempData.categoryName,
            description: tempData.description,
          } as Record<string, unknown>,
        };
      }

      if (resolved === 'NO') {
        const negotiationRounds = ((tempData.negotiationRounds as number) || 0) + 1;
        const professionalId = tempData.professionalId as string;
        const professionalName = (tempData.professionalName as string) || 'el profesional';

        if (negotiationRounds >= MAX_NEGOTIATION_ROUNDS) {
          const requestsRepo = new RequestsRepository();
          const usersRepo = new UsersRepository();
          const matchingRepo = new MatchingRepository();
          const botRepo = new BotRepository();
          const requestsService = new RequestsService(requestsRepo, usersRepo, matchingRepo, botRepo);

          try {
            await requestsService.reassignAfterNegotiation(requestId, professionalId);
            console.log(
              '[CoordinationFlow] Negotiation exhausted, reassigning:',
              { requestId, professionalId },
            );
          } catch (err) {
            console.error('[CoordinationFlow] Failed to reassign after negotiation:', err);
          }

          const professionalName = (tempData.professionalName as string) || 'el profesional';
          const categoryName = (tempData.categoryName as string) || 'el servicio';
          const message = `No pudimos coordinar un horario con ${professionalName}, tu ${categoryName}. Estamos buscando otro profesional disponible para tu pedido.\n\n1. Seguir esperando\n2. Cancelar mi pedido`;

          return {
            response: {
              text: message,
            },
            nextStep: null,
            tempData: { _clearTempData: true } as Record<string, unknown>,
          };
        }

        await prisma.request.update({
          where: { id: requestId },
          data: {
            coordinationStatus: 'AWAITING_AVAILABILITY',
            negotiationRounds,
            clientAvailability: null,
          },
        });

        const categoryName = (tempData.categoryName as string) || 'el servicio';

        return {
          response: {
            text: `Entendido. ¿Qué otro día y horario tenés disponible para la visita de ${professionalName} (${categoryName})? Si necesitás cancelar, escribí "cancelar".`,
          },
          nextStep: 'AWAITING_AVAILABILITY',
          tempData: {
            requestId,
            userId: tempData.userId,
            userName: tempData.userName,
            userPhone: tempData.userPhone,
            professionalId: tempData.professionalId,
            professionalName: tempData.professionalName,
            professionalPhone: tempData.professionalPhone,
            categoryName: tempData.categoryName,
            description: tempData.description,
            negotiationRounds,
          },
        };
      }

      if (!resolved) {
        const professionalName = (tempData.professionalName as string) || 'el profesional';
        const alternativeScheduledAt = tempData.alternativeScheduledAt as string;
        let alternativeText = 'ese horario';
        if (alternativeScheduledAt) {
          alternativeText = `el ${formatDateTimeArgentina(new Date(alternativeScheduledAt))}`;
        }
        const stepContext = `${professionalName} propone ${alternativeText}. Se le preguntó al usuario si le viene bien. Opciones: 1. Sí, perfecto, 2. No me viene bien.`;
        const offTopic = await generateOffTopicResponse(response, stepContext);
        if (offTopic) {
          return {
            response: { text: offTopic },
            nextStep: 'AWAITING_USER_CONFIRMATION',
            tempData,
          };
        }
      }
    }

    const professionalName = (tempData.professionalName as string) || 'el profesional';
    const alternativeScheduledAt = tempData.alternativeScheduledAt as string;
    let alternativeText = 'ese horario';

    if (alternativeScheduledAt) {
      const parsed = new Date(alternativeScheduledAt);
      const formatted = formatDateTimeArgentina(parsed);
      alternativeText = `el ${formatted}`;
    }

    return {
      response: {
        text: `${professionalName} propone ${alternativeText}. ¿Te viene bien?\n1. Sí, perfecto\n2. No me viene bien`,
      },
      nextStep: 'AWAITING_USER_CONFIRMATION',
      tempData,
    };
  }

  private async handleAwaitingGps(
    message: { text?: string; location?: { latitude: number; longitude: number } },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'USER') {
      return {
        response: { text: 'Esperando que el usuario comparta su ubicación.' },
        nextStep: 'AWAITING_GPS',
        tempData,
      };
    }

    const requestId = tempData.requestId as string;

    if (message.location) {
      const { latitude, longitude } = message.location;

      await prisma.request.update({
        where: { id: requestId },
        data: { userLatitude: latitude, userLongitude: longitude },
      });

      const { reverseGeocode } = await import('../../../lib/nominatim-client');
      reverseGeocode(latitude, longitude).then(async (result) => {
        if (result.neighborhood) {
          await prisma.request.update({
            where: { id: requestId },
            data: { clientNeighborhood: result.neighborhood },
          });
        }
      }).catch(err => console.error('[CoordinationFlow] Nominatim GPS failed:', err));
    }

    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
      select: { clientAddress: true },
    });

    if (existingRequest?.clientAddress) {
      return this.finalizeLocation(existingRequest.clientAddress, requestId, tempData);
    }

    return {
      response: {
        text: 'Por favor, indicá la dirección exacta donde realizarás el trabajo (calle, número, piso, depto, referencia o número de manzana si es barrio privado).',
      },
      nextStep: 'AWAITING_LOCATION',
      tempData,
    };
  }

  private async handleAwaitingLocation(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    const requestId = tempData.requestId as string;

    if (role !== 'USER') {
      return {
        response: { text: 'Esperando que el usuario comparta su direccion.' },
        nextStep: 'AWAITING_LOCATION',
        tempData,
      };
    }

    // --- Sub-step: usuario está respondiendo a una sugerencia de dirección existente ---
    if (tempData._locationSuggestions) {
      return this.handleLocationSuggestionResponse(message, tempData);
    }

    const address = message.text?.trim();

    // --- Caso: ya viene con clientAddress pre-llenado (reutilizó savedLocation) ---
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { clientAddress: true, geoNodeId: true, userId: true, userLatitude: true, userLongitude: true },
    });

    if (!address && request?.clientAddress) {
      return this.finalizeLocation(request.clientAddress, requestId, tempData);
    }

    if (!address) {
      // --- Caso B: no escribió dirección. Buscar sugerencias por geoNodeId ---
      const userId = request?.userId;
      const geoNodeId = request?.geoNodeId;

      if (userId && geoNodeId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const savedLocations = (user?.savedLocations as unknown as SavedLocation[]) || [];
        const matches = findLocationsByGeoNode(savedLocations, geoNodeId);

        if (matches.length > 0) {
          const list = matches.map((loc, i) => `${i + 1}. ${loc.address}`).join('\n');
          const otherOptionNumber = matches.length + 1;

          return {
            response: {
              text: `Para coordinar la visita necesito la dirección exacta. ¿Es alguna de estas?\n\n${list}\n${otherOptionNumber}. Es otra dirección`,
            },
            nextStep: 'AWAITING_LOCATION',
            tempData: {
              ...tempData,
              _locationSuggestions: matches.map((m) => ({ id: m.id, address: m.address })),
            },
          };
        }
      }

      return {
        response: {
          text: 'Por favor, indicá la dirección exacta donde realizarás el trabajo (calle, número, piso, depto, referencia o número de manzana si es barrio privado).',
        },
        nextStep: 'AWAITING_LOCATION',
        tempData,
      };
    }

    // --- Caso A: escribió una dirección de texto ---
    return this.finalizeLocation(address, requestId, tempData);
  }

  private async handleLocationSuggestionResponse(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const requestId = tempData.requestId as string;
    const suggestions = (tempData._locationSuggestions as { id: string; address: string }[]) || [];
    const inputText = message.text?.trim() || '';
    const number = parseInt(inputText, 10);
    const otherOptionNumber = suggestions.length + 1;

    if (!isNaN(number) && number >= 1 && number <= suggestions.length) {
      const chosen = suggestions[number - 1];

      const request = await prisma.request.findUnique({ where: { id: requestId }, select: { userId: true } });
      if (request?.userId) {
        const user = await prisma.user.findUnique({ where: { id: request.userId } });
        const savedLocations = (user?.savedLocations as unknown as SavedLocation[]) || [];
        await touchSavedLocation(this.usersRepository, request.userId, savedLocations, chosen.id);
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _locationSuggestions, ...cleanTempData } = tempData;
      return this.finalizeLocation(chosen.address, requestId, cleanTempData);
    }

    if (number === otherOptionNumber) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _locationSuggestions, ...cleanTempData } = tempData;
      return {
        response: {
          text: 'Por favor, indicá la dirección exacta donde realizarás el trabajo (calle, número, piso, depto, referencia o número de manzana si es barrio privado).',
        },
        nextStep: 'AWAITING_LOCATION',
        tempData: cleanTempData,
      };
    }

    const list = suggestions.map((s, i) => `${i + 1}. ${s.address}`).join('\n');
    return {
      response: {
        text: `Elegí una opción:\n\n${list}\n${otherOptionNumber}. Es otra dirección`,
      },
      nextStep: 'AWAITING_LOCATION',
      tempData,
    };
  }

  private async finalizeLocation(
    address: string,
    requestId: string,
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    await prisma.request.update({
      where: { id: requestId },
      data: {
        coordinationStatus: 'SCHEDULED',
        clientAddress: address,
      },
    });

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        scheduledAt: true,
        userLatitude: true,
        userLongitude: true,
        geoNodeId: true,
        geoNode: { select: { name: true } },
        userId: true,
        user: { select: { name: true, phone: true } },
      },
    });

    // --- Persistir en savedLocations (solo si la dirección no vino de una savedLocation ya tocada) ---
    if (request?.userId && !tempData._locationSuggestions) {
      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      const currentLocations = (user?.savedLocations as unknown as SavedLocation[]) || [];

      const maxLocationsConfig = await this.configRepository.findByKey('USER_MAX_SAVED_LOCATIONS');
      const parsedMax = maxLocationsConfig ? parseInt(maxLocationsConfig.value, 10) : DEFAULT_MAX_SAVED_LOCATIONS;
      const maxLocations = isNaN(parsedMax) ? DEFAULT_MAX_SAVED_LOCATIONS : parsedMax;

      await upsertSavedLocationByAddress(this.usersRepository, request.userId, currentLocations, {
        geoNodeId: request.geoNodeId ?? undefined,
        zoneName: request.geoNode?.name,
        lat: request.userLatitude ?? undefined,
        lng: request.userLongitude ?? undefined,
        address,
      }, maxLocations);
    }

    const scheduledAt = request?.scheduledAt;

    let scheduleText = '';
    if (scheduledAt) {
      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const dayName = dayNames[getDayArgentina(scheduledAt)];
      const hours = getHoursArgentina(scheduledAt).toString().padStart(2, '0');
      const minutes = getMinutesArgentina(scheduledAt).toString().padStart(2, '0');
      scheduleText = `el ${dayName} a las ${hours}:${minutes}`;
    }

    const userName = request?.user?.name || 'el usuario';
    const userPhone = request?.user?.phone || 'No disponible';

    this.coordinationService.notifyProfessionalVisitConfirmed(
      tempData.professionalPhone as string,
      userName,
      scheduleText,
      address,
      userPhone,
      request?.userLatitude ?? null,
      request?.userLongitude ?? null,
    ).catch((err) => {
      console.error('[CoordinationFlow] Failed to notify professional visit confirmed:', err);
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _locationSuggestions, ...cleanTempData } = tempData;

    return {
      response: {
        text: `¡Todo listo! ${tempData.professionalName || 'El profesional'} ya tiene tus datos para la visita.`,
      },
      nextStep: 'AWAITING_VISIT',
      tempData: {
        ...cleanTempData,
        clientAddress: address,
      },
    };
  }

  private async handleAwaitingVisit(
    _message: { text?: string },
    tempData: Record<string, unknown>,
    _role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    return {
      response: { text: 'Ya tenés la visita coordinada. Te avisaremos cuando haya novedades.' },
      nextStep: 'AWAITING_VISIT',
      tempData,
    };
  }

  private async handleAwaitingVisitConfirmation(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    if (role !== 'PROFESSIONAL') {
      return {
        response: { text: 'Esperando confirmación del profesional.' },
        nextStep: 'AWAITING_VISIT_CONFIRMATION',
        tempData,
      };
    }

    const inputText = message.text?.trim().toLowerCase() || '';
    const resolved = await resolveOptionWithFallback('AWAITING_VISIT_CONFIRMATION', inputText);

    if (resolved === 'CONFIRM') {
      return {
        response: { text: '¡Perfecto! Visita confirmada. Te esperamos mañana.' },
        nextStep: null,
        tempData: {},
      };
    }

    if (resolved === 'CANCEL') {
      const requestId = tempData.requestId as string;
      const professionalId = tempData.professionalId as string;

      if (!requestId || !professionalId) {
        return {
          response: {
            text: 'No pude identificar el pedido a cancelar. Escribinos para revisarlo.',
          },
          nextStep: null,
          tempData: { _clearTempData: true },
        };
      }

      try {
        const result = await this.requestsService.cancelByProfessional(requestId, professionalId);

        let responseText = 'Entendido. Cancelaste la visita. Le avisamos al usuario y buscamos otro profesional.';

        const abuseDetection = new AbuseDetectionService();
        const abuseLevel = await abuseDetection.checkProfessionalAbuse(professionalId);

        if (abuseLevel === 'warn') {
          await prisma.professional.update({
            where: { id: professionalId },
            data: { abuseWarningCount: { increment: 1 } },
          });
          responseText += '\n\n⚠️ Notamos varias cancelaciones de tu parte. Esto afecta la experiencia de los usuarios. Si esto continúa, tu cuenta podría ser suspendida.';
        }

        if (abuseLevel === 'suspend') {
          await prisma.professional.update({
            where: { id: professionalId },
            data: { status: 'SUSPENDED' },
          });
        }

        return {
          response: {
            text: responseText,
          },
          nextStep: null,
          tempData: {
            _clearTempData: true,
            pendingNotification: {
              targetPhone: result.userPhone,
              targetRole: 'USER',
              message: result.userMessage,
              flow: null,
              step: null,
              tempData: {},
            },
          } as Record<string, unknown>,
        };
      } catch (err) {
        console.error('[CoordinationFlow] Failed to cancel visit:', err);
        return {
          response: {
            text: 'No pude cancelar la visita en este momento. Intentá nuevamente en unos minutos.',
          },
          nextStep: 'AWAITING_VISIT_CONFIRMATION',
          tempData,
        };
      }
    }

    if (!resolved) {
      const stepContext = `Se le recordó al profesional que tiene una confirmación pendiente para una visita. Opciones: 1. Confirmo, 2. Cancelar.`;
      const offTopic = await generateOffTopicResponse(inputText, stepContext);
      if (offTopic) {
        return {
          response: { text: offTopic },
          nextStep: 'AWAITING_VISIT_CONFIRMATION',
          tempData,
        };
      }
    }

    return {
      response: {
        text: 'No entendí. Respondé:\n1. Confirmo\n2. Cancelar',
      },
      nextStep: 'AWAITING_VISIT_CONFIRMATION',
      tempData,
    };
  }

  private isSameSchedule(proposed: Date, available: Date | null): boolean {
    if (!available) return false;

    return (
      getDayArgentina(proposed) === getDayArgentina(available) &&
      Math.abs(
        getHoursArgentina(proposed) * 60 + getMinutesArgentina(proposed) -
        (getHoursArgentina(available) * 60 + getMinutesArgentina(available))
      ) <= 15
    );
  }
}
