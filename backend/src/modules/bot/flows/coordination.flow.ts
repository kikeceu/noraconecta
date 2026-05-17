import { FlowContext, FlowHandler, FlowStepResult } from './types';
import prisma from '../../../lib/prisma';
import { parseExactDate, getDayArgentina, getHoursArgentina, getMinutesArgentina, formatDateTimeArgentina } from '../../../utils/date-utils';
import { RequestsService } from '../../requests/requests.service';
import { RequestsRepository } from '../../requests/requests.repository';
import { MatchingRepository } from '../../matching/matching.repository';
import { UsersRepository } from '../../users/users.repository';
import { BotRepository } from '../../bot/bot.repository';
import { handleCancelConfirmation } from './cancel-flow.helper';
import { resolveOption } from './option-resolver.helper';

const MAX_NEGOTIATION_ROUNDS = 3;

export class CoordinationFlow implements FlowHandler {
  readonly flowName = 'COORDINATION';

  constructor(private readonly requestsService: RequestsService) {}

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
      case 'AWAITING_USER_CONFIRMATION':
        return this.handleAwaitingUserConfirmation(message, tempData, role);
      case 'AWAITING_LOCATION':
        return this.handleAwaitingLocation(message, tempData, role);
      case 'CANCEL_CONFIRMATION':
        return handleCancelConfirmation(context, this.requestsService);
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
        tempData: {},
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

    if (['ver detalles', 'detalle', 'detalles', 'ver pedido'].includes(inputText)) {
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
          tempData: {},
        };
      }

      const categoryName = request.category?.name || 'el servicio';
      const zoneName = request.geoNode?.name || 'tu zona';

      return {
        response: {
          text: [
            `Pedido de ${categoryName} en ${zoneName}.`,
            `Descripción: ${request.description}`,
            '1. Aceptar\n2. Rechazar',
          ].join('\n\n'),
          mediaUrls: request.photoUrls,
          audioUrl: request.audioUrl || undefined,
        },
        nextStep: 'AWAITING_ACCEPTANCE',
        tempData,
      };
    }

    const resolved = resolveOption('AWAITING_ACCEPTANCE', inputText);

    if (resolved === 'ACCEPT') {
      try {
        await this.requestsService.accept(requestId);

        return {
          response: {
            text: '¡Perfecto! Aceptaste el pedido. El usuario va a coordinar la visita por acá.',
          },
          nextStep: null,
          tempData: {},
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'No se pudo aceptar el pedido.';

        return {
          response: { text: errorMessage },
          nextStep: null,
          tempData: {},
        };
      }
    }

    if (resolved === 'REJECT') {
      try {
        await this.requestsService.reject(requestId);

        return {
          response: {
            text: 'Entendido. Rechazaste el pedido.',
          },
          nextStep: null,
          tempData: {},
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'No se pudo rechazar el pedido.';

        return {
          response: { text: errorMessage },
          nextStep: null,
          tempData: {},
        };
      }
    }

    return {
      response: {
        text: 'Respondé con una opción:\n\n1. Aceptar\n2. Rechazar',
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
      const parsedDate = parseExactDate(availability);

      if (!parsedDate) {
        return {
          response: {
            text: 'El formato no es válido. Escribí así: DD/MM HH:MM (ejemplo: 20/06 16:00)',
          },
          nextStep: 'AWAITING_AVAILABILITY',
          tempData: { ...tempData, negotiationRounds },
        };
      }

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
              text: 'Ese horario no está disponible para el profesional. Proponé otro día y hora: DD/MM HH:MM (ejemplo: 20/06 16:00)',
            },
            nextStep: 'AWAITING_AVAILABILITY',
            tempData: { ...tempData, negotiationRounds },
          };
        }
      }

      console.log('[CoordinationFlow] handleAwaitingAvailability - updating request:', {
        requestId,
        coordinationStatus: 'AWAITING_CONFIRMATION',
        availability,
        scheduledAt: parsedDate.toISOString(),
      });

      const request = await prisma.request.update({
        where: { id: requestId },
        data: {
          coordinationStatus: 'AWAITING_CONFIRMATION',
          clientAvailability: availability,
          scheduledAt: parsedDate,
        },
        include: {
          user: { select: { name: true, phone: true } },
          assignedProfessional: { select: { name: true, phone: true } },
          category: { select: { name: true } },
        },
      });

      console.log('[CoordinationFlow] handleAwaitingAvailability - request updated:', {
        requestId,
        newCoordinationStatus: request.coordinationStatus,
        scheduledAt: request.scheduledAt?.toISOString(),
      });

      const professionalName = request.assignedProfessional?.name || 'El profesional';

      const formattedDate = formatDateTimeArgentina(parsedDate);

      const professionalMessage = `Tu cliente ${request.user?.name || 'el usuario'} puede el ${formattedDate}. ¿Confirmás? Respondé Sí, o escribí otro horario: DD/MM HH:MM (ejemplo: 20/06 17:00)`;

      return {
        response: {
          text: `Le aviso a ${professionalName} que podés ${formattedDate}. Esperá su confirmación.`,
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
              professionalName: professionalName,
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
        tempData: {},
      };
    }

    const professionalName = request.assignedProfessional?.name || 'El profesional';
    const categoryName = request.category?.name || 'el servicio';

    const messageText = negotiationRounds > 0
      ? `¿Qué otro día y horario tenés disponible para la visita de ${professionalName} (${categoryName})? Escribí así: DD/MM HH:MM (ejemplo: 20/06 16:00)`
      : `¡Buenas noticias! ${professionalName} aceptó tu pedido de ${categoryName}. Para coordinar la visita, indicá un día y horario en que podés recibir al profesional. Escribí así: DD/MM HH:MM (ejemplo: 20/06 16:00). Si necesitás cancelar, escribí "cancelar".`;

    return {
      response: {
        text: messageText,
      },
      nextStep: 'AWAITING_AVAILABILITY',
      tempData: { ...tempData, negotiationRounds },
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
      const resolved = resolveOption('AWAITING_CONFIRMATION', scheduleText);

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

        const userMessage = `${professionalName} confirmó la visita para el ${dayName} a las ${hours}:${minutes}. Para que pueda encontrarte, respondé con tu dirección exacta (calle, número, piso/depto, referencia de acceso) y compartí tu ubicación desde WhatsApp.`;

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
              step: 'AWAITING_LOCATION',
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

      const newScheduledAt = parseExactDate(scheduleText);

      if (!newScheduledAt) {
        return {
          response: {
            text: 'El formato no es válido. Escribí así: DD/MM HH:MM (ejemplo: 20/06 17:00)',
          },
          nextStep: 'AWAITING_CONFIRMATION',
          tempData,
        };
      }

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
              text: 'Ya tenés una visita confirmada en ese día y hora. Proponé otro horario: DD/MM HH:MM (ejemplo: 20/06 17:00)',
            },
            nextStep: 'AWAITING_CONFIRMATION',
            tempData,
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
            scheduledAt: newScheduledAt,
          },
        });

        const userName = tempData.userName as string;
        const professionalName = tempData.professionalName as string;

        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const dayName = dayNames[getDayArgentina(newScheduledAt)];
        const hours = getHoursArgentina(newScheduledAt).toString().padStart(2, '0');
        const minutes = getMinutesArgentina(newScheduledAt).toString().padStart(2, '0');

        const userMessage = `${professionalName} confirmó la visita para el ${dayName} a las ${hours}:${minutes}. Para que pueda encontrarte, respondé con tu dirección exacta (calle, número, piso/depto, referencia de acceso) y compartí tu ubicación desde WhatsApp.`;

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
              step: 'AWAITING_LOCATION',
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
          scheduledAt: newScheduledAt,
        },
      });

      const userName = tempData.userName as string;
      const professionalName = tempData.professionalName as string;

      const alternativeText = formatDateTimeArgentina(newScheduledAt);

      const userMessage = `${professionalName} propone el ${alternativeText}. ¿Te viene bien? (Sí / No)`;

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

    const userName = (tempData.userName as string) || 'el usuario';
    const scheduledAtStr = tempData.scheduledAt as string | undefined;

    let formattedDate = 'ese horario';
    if (scheduledAtStr) {
      const parsed = new Date(scheduledAtStr);
      formattedDate = formatDateTimeArgentina(parsed);
    }

    return {
      response: {
        text: `Tu cliente ${userName} puede el ${formattedDate}. ¿Confirmás? Respondé Sí, o escribí otro horario: DD/MM HH:MM (ejemplo: 20/06 17:00)`,
      },
      nextStep: 'AWAITING_CONFIRMATION',
      tempData,
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

      const resolved = resolveOption('AWAITING_USER_CONFIRMATION', response);

      if (resolved === 'YES') {
        const alternativeScheduledAt = new Date(tempData.alternativeScheduledAt as string);
        const professionalName = (tempData.professionalName as string) || 'El profesional';

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

        const professionalMessage = `El cliente aceptó el ${dayName} a las ${hours}:${minutes}. Visita confirmada.`;

        const userMessage = `¡Buenísimo! Le confirmo a ${professionalName} la visita para el ${dayName} a las ${hours}:${minutes}.\n\nAhora, para que pueda encontrarte, respondé con tu dirección exacta (calle, número, piso/depto, referencia de acceso) y compartí tu ubicación desde WhatsApp.`;

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
            pendingNotification: {
              targetPhone: tempData.professionalPhone,
              targetRole: 'PROFESSIONAL',
              message: professionalMessage,
              flow: null,
              step: null,
              tempData: {},
            },
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

          let reassigned = false;
          try {
            const result = await requestsService.reassignAfterNegotiation(requestId, professionalId);
            reassigned = true;
            console.log(
              '[CoordinationFlow] Negotiation exhausted, reassigned:',
              { requestId, professionalId, newStatus: result?.status },
            );
          } catch (err) {
            console.error('[CoordinationFlow] Failed to reassign after negotiation:', err);
          }

          const message = reassigned
            ? `No pudimos coordinar un horario con ${professionalName}. Buscamos otro profesional disponible.`
            : `No pudimos coordinar un horario con ${professionalName}. Voy a buscar otro profesional para tu pedido.`;

          return {
            response: {
              text: message,
            },
            nextStep: null,
            tempData: {} as Record<string, unknown>,
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
            text: `Entendido. ¿Qué otro día y horario tenés disponible para la visita de ${professionalName} (${categoryName})? Escribí así: DD/MM HH:MM (ejemplo: 20/06 16:00)`,
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
    }

    const professionalName = (tempData.professionalName as string) || 'el profesional';
    const alternativeScheduledAt = tempData.alternativeScheduledAt as string;
    let alternativeText = 'ese horario';

    if (alternativeScheduledAt) {
      const parsed = new Date(alternativeScheduledAt);
      const formatted = formatDateTimeArgentina(parsed);
      const [datePart, timePart] = formatted.split(' ');
      alternativeText = `el ${datePart} a las ${timePart}`;
    }

    return {
      response: {
        text: `${professionalName} propone ${alternativeText}. ¿Te viene bien? (Respondé "Sí" o "No")`,
      },
      nextStep: 'AWAITING_USER_CONFIRMATION',
      tempData,
    };
  }

  private async handleAwaitingLocation(
    message: { text?: string; location?: { latitude: number; longitude: number } },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    const requestId = tempData.requestId as string;

    if (role !== 'USER') {
      return {
        response: { text: 'Esperando que el usuario comparta su ubicación.' },
        nextStep: 'AWAITING_LOCATION',
        tempData,
      };
    }

    const clientAddress = (tempData.clientAddress as string) || '';
    const clientLatitude = tempData.clientLatitude as number | undefined;
    const clientLongitude = tempData.clientLongitude as number | undefined;

    let newAddress = clientAddress;
    let newLat = clientLatitude;
    let newLng = clientLongitude;

    if (message.text?.trim() && !isLocationLikeMessage(message.text.trim())) {
      newAddress = message.text.trim();
    }

    if (message.location) {
      newLat = message.location.latitude;
      newLng = message.location.longitude;
    }

    const hasAddress = !!newAddress;
    const hasLocation = newLat !== undefined && newLng !== undefined;

    if (hasAddress && hasLocation) {
      await prisma.request.update({
        where: { id: requestId },
        data: {
          coordinationStatus: 'SCHEDULED',
          clientAddress: newAddress,
          clientLatitude: newLat,
          clientLongitude: newLng,
        },
      });

      const request = await prisma.request.findUnique({
        where: { id: requestId },
        select: {
          scheduledAt: true,
          description: true,
          user: { select: { name: true, phone: true } },
        },
      });

      const scheduledAt = request?.scheduledAt;
      const userPhone = request?.user?.phone;

      let scheduleText = '';
      if (scheduledAt) {
        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const dayName = dayNames[getDayArgentina(scheduledAt)];
        const hours = getHoursArgentina(scheduledAt).toString().padStart(2, '0');
        const minutes = getMinutesArgentina(scheduledAt).toString().padStart(2, '0');
        scheduleText = `el ${dayName} a las ${hours}:${minutes}`;
      }

      const mapsLink = `https://maps.google.com/?q=${newLat},${newLng}`;

      const professionalMessage =
        `Visita confirmada ✅\n` +
        `Cliente: ${request?.user?.name || 'el usuario'}\n` +
        `Pedido: ${request?.description || 'Sin descripción'}\n` +
        (scheduleText ? `Día y hora: ${scheduleText}\n` : '') +
        `Dirección: ${newAddress}\n` +
        `Ubicación: ${mapsLink}\n` +
        `Teléfono del cliente: ${userPhone || 'No disponible'}`;

      return {
        response: {
          text: `¡Todo listo! ${tempData.professionalName || 'El profesional'} ya tiene tus datos para la visita.`,
        },
        nextStep: null,
        tempData: {
          requestId,
          pendingNotification: {
            targetPhone: tempData.professionalPhone,
            targetRole: 'PROFESSIONAL',
            message: professionalMessage,
            flow: null,
            step: null,
            tempData: {},
          },
        } as Record<string, unknown>,
      };
    }

    if (!hasAddress && !hasLocation) {
      return {
        response: {
          text: 'Para que el profesional pueda encontrarte, necesito tu dirección exacta (calle, número, piso/depto, referencia) y tu ubicación. Podés compartir el pin desde WhatsApp.',
        },
        nextStep: 'AWAITING_LOCATION',
        tempData,
      };
    }

    if (!hasAddress) {
      return {
        response: {
          text: 'Gracias por la ubicación. Ahora necesito tu dirección exacta (calle, número, piso/depto, referencia de acceso).',
        },
        nextStep: 'AWAITING_LOCATION',
        tempData: {
          ...tempData,
          clientLatitude: newLat,
          clientLongitude: newLng,
        },
      };
    }

    return {
      response: {
        text: 'Gracias por la dirección. Ahora compartíme tu ubicación desde WhatsApp para que el profesional pueda llegar.',
      },
      nextStep: 'AWAITING_LOCATION',
      tempData: {
        ...tempData,
        clientAddress: newAddress,
      },
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

function isLocationLikeMessage(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  const coordPattern = /^(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/;
  return coordPattern.test(trimmed);
}
