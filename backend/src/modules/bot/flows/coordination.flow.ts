import { FlowContext, FlowHandler, FlowStepResult } from './types';
import prisma from '../../../lib/prisma';
import { parseScheduledAt } from '../../../lib/llm';
import { RequestsService } from '../../requests/requests.service';
import { RequestsRepository } from '../../requests/requests.repository';
import { UsersRepository } from '../../users/users.repository';

const MAX_NEGOTIATION_ROUNDS = 3;

export class CoordinationFlow implements FlowHandler {
  readonly flowName = 'COORDINATION';

  getInitialStep(): string {
    return 'AWAITING_AVAILABILITY';
  }

  async handleStep(step: string, context: FlowContext): Promise<FlowStepResult> {
    const { session, message } = context;
    const tempData = (session.tempData as Record<string, unknown>) || {};
    const role = session.role as 'USER' | 'PROFESSIONAL';

    switch (step) {
      case 'AWAITING_AVAILABILITY':
        return this.handleAwaitingAvailability(message, tempData, role);
      case 'AWAITING_CONFIRMATION':
        return this.handleAwaitingConfirmation(message, tempData, role);
      case 'AWAITING_USER_CONFIRMATION':
        return this.handleAwaitingUserConfirmation(message, tempData, role);
      case 'AWAITING_LOCATION':
        return this.handleAwaitingLocation(message, tempData, role);
      default:
        return this.handleAwaitingAvailability(message, tempData, role);
    }
  }

  private async handleAwaitingAvailability(
    message: { text?: string },
    tempData: Record<string, unknown>,
    role: 'USER' | 'PROFESSIONAL',
  ): Promise<FlowStepResult> {
    const requestId = tempData.requestId as string;
    const negotiationRounds = (tempData.negotiationRounds as number) || 0;

    if (role === 'USER' && message.text?.trim()) {
      const availability = message.text.trim();
      const userProposedAt = this.parseScheduleDate(availability);

      const request = await prisma.request.update({
        where: { id: requestId },
        data: {
          coordinationStatus: 'AWAITING_CONFIRMATION',
          clientAvailability: availability,
        },
        include: {
          user: { select: { name: true, phone: true } },
          assignedProfessional: { select: { name: true, phone: true } },
          category: { select: { name: true } },
        },
      });

      const professionalName = request.assignedProfessional?.name || 'El profesional';

      const professionalMessage = `Tu cliente ${request.user?.name || 'el usuario'} puede ${availability}. ¿Confirmás ese horario o proponés uno alternativo?`;

      return {
        response: {
          text: `Le aviso a ${professionalName} que podés ${availability}. Esperá su confirmación.`,
        },
        nextStep: null,
        tempData: {
          requestId,
          availability,
          userProposedAt: userProposedAt?.toISOString() || null,
          negotiationRounds,
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
              userProposedAt: userProposedAt?.toISOString() || null,
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
      ? `¿Qué otros días y horarios tenés disponibles para la visita de ${professionalName} (${categoryName})?`
      : `¡Buenas noticias! ${professionalName} aceptó tu pedido de ${categoryName}. ¿Qué días y horarios tenés disponibles para la visita?`;

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
      const now = new Date();

      const request = await prisma.request.findUnique({
        where: { id: requestId },
        select: { clientAvailability: true },
      });

      const clientAvailability = request?.clientAvailability ?? undefined;
      let parsedFromProfessionalsText = false;

      let professionalScheduledAt = await parseScheduledAt(
        scheduleText,
        now,
        clientAvailability,
      );

      if (professionalScheduledAt) {
        parsedFromProfessionalsText = true;
      }

      if (!professionalScheduledAt && clientAvailability) {
        professionalScheduledAt = await parseScheduledAt(clientAvailability, now);
      }

      if (!professionalScheduledAt) {
        await prisma.request.update({
          where: { id: requestId },
          data: {
            coordinationStatus: 'AWAITING_AVAILABILITY',
            clientAvailability: null,
          },
        });

        const userMessage =
          'No pude entender el horario. ¿Podés escribirlo así? Ejemplo: viernes 9 de mayo a las 18:00';

        return {
          response: {
            text: 'No pude interpretar el horario. Le pido al usuario que lo especifique mejor.',
          },
          nextStep: null,
          tempData: {
            requestId,
            pendingNotification: {
              targetPhone: tempData.userPhone,
              targetRole: 'USER',
              message: userMessage,
              flow: 'COORDINATION',
              step: 'AWAITING_AVAILABILITY',
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
                negotiationRounds: tempData.negotiationRounds,
              },
            },
          } as Record<string, unknown>,
        };
      }

      const userProposedAtStr = tempData.userProposedAt as string | undefined;
      const userProposedAt = userProposedAtStr ? new Date(userProposedAtStr) : null;

      const isAlternative = parsedFromProfessionalsText && (
        !userProposedAt || !this.isSameSchedule(professionalScheduledAt, userProposedAt)
      );

      if (isAlternative) {
        const userName = tempData.userName as string;
        const professionalName = tempData.professionalName as string;
        const availability = (tempData.availability as string) || 'ese horario';

        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const dayName = dayNames[professionalScheduledAt.getDay()];
        const hours = professionalScheduledAt.getHours().toString().padStart(2, '0');
        const minutes = professionalScheduledAt.getMinutes().toString().padStart(2, '0');
        const alternativeText = `el ${dayName} a las ${hours}:${minutes}`;

        await prisma.request.update({
          where: { id: requestId },
          data: {
            coordinationStatus: 'AWAITING_USER_CONFIRMATION',
            scheduledAt: professionalScheduledAt,
          },
        });

        const userMessage = `${professionalName} no puede ${availability}. Propone ${alternativeText}. ¿Te viene bien? (Sí / No)`;

        return {
          response: {
            text: `Le aviso a ${userName} que proponés ${alternativeText}.`,
          },
          nextStep: null,
          tempData: {
            requestId,
            alternativeScheduledAt: professionalScheduledAt.toISOString(),
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
                alternativeScheduledAt: professionalScheduledAt.toISOString(),
                availability,
                userProposedAt: userProposedAtStr,
                negotiationRounds: tempData.negotiationRounds,
              },
            },
          } as Record<string, unknown>,
        };
      }

      await prisma.request.update({
        where: { id: requestId },
        data: {
          coordinationStatus: 'AWAITING_LOCATION',
          scheduledAt: professionalScheduledAt,
        },
      });

      const userName = tempData.userName as string;
      const professionalName = tempData.professionalName as string;

      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const dayName = dayNames[professionalScheduledAt.getDay()];
      const hours = professionalScheduledAt.getHours().toString().padStart(2, '0');
      const minutes = professionalScheduledAt.getMinutes().toString().padStart(2, '0');

      const userMessage = `${professionalName} confirmó la visita para el ${dayName} a las ${hours}:${minutes}. Para que pueda encontrarte, respondé con tu dirección exacta (calle, número, piso/depto, referencia de acceso) y compartí tu ubicación desde WhatsApp.`;

      return {
        response: {
          text: `Horario confirmado para el ${dayName} a las ${hours}:${minutes}. Le aviso a ${userName}.`,
        },
        nextStep: null,
        tempData: {
          requestId,
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
              scheduledAt: professionalScheduledAt.toISOString(),
            },
          },
        } as Record<string, unknown>,
      };
    }

    const userName = (tempData.userName as string) || 'el usuario';
    const availability = (tempData.availability as string) || 'en ese horario';

    return {
      response: {
        text: `Tu cliente ${userName} puede ${availability}. ¿Confirmás un horario? (Ej: "martes a las 10 de la mañana")`,
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

      const isYes = this.isAffirmative(response);
      const isNo = this.isNegative(response);

      if (isYes) {
        const alternativeScheduledAt = new Date(tempData.alternativeScheduledAt as string);
        const professionalName = (tempData.professionalName as string) || 'El profesional';

        await prisma.request.update({
          where: { id: requestId },
          data: {
            coordinationStatus: 'AWAITING_LOCATION',
            scheduledAt: alternativeScheduledAt,
          },
        });

        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const dayName = dayNames[alternativeScheduledAt.getDay()];
        const hours = alternativeScheduledAt.getHours().toString().padStart(2, '0');
        const minutes = alternativeScheduledAt.getMinutes().toString().padStart(2, '0');

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

      if (isNo) {
        const negotiationRounds = ((tempData.negotiationRounds as number) || 0) + 1;
        const professionalId = tempData.professionalId as string;
        const professionalName = (tempData.professionalName as string) || 'el profesional';

        if (negotiationRounds >= MAX_NEGOTIATION_ROUNDS) {
          const requestsRepo = new RequestsRepository();
          const usersRepo = new UsersRepository();
          const requestsService = new RequestsService(requestsRepo, usersRepo);

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
            text: `Entendido. ¿Qué otros días y horarios tenés disponibles para la visita de ${professionalName} (${categoryName})?`,
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
      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const dayName = dayNames[parsed.getDay()];
      const hours = parsed.getHours().toString().padStart(2, '0');
      const minutes = parsed.getMinutes().toString().padStart(2, '0');
      alternativeText = `el ${dayName} a las ${hours}:${minutes}`;
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
        const dayName = dayNames[scheduledAt.getDay()];
        const hours = scheduledAt.getHours().toString().padStart(2, '0');
        const minutes = scheduledAt.getMinutes().toString().padStart(2, '0');
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

  private parseScheduleDate(input: string): Date | null {
    const now = new Date();
    const normalized = input.toLowerCase().trim();

    const dayMap: Record<string, number> = {
      domingo: 0, lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
      jueves: 4, viernes: 5, sábado: 6, sabado: 6,
    };

    const timeMatch = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(?:hs|horas|am|pm)?/);
    if (!timeMatch) return null;

    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

    if (normalized.includes('pm') && hours < 12) hours += 12;
    if (normalized.includes('am') && hours === 12) hours = 0;

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    let targetDay = -1;
    for (const [name, day] of Object.entries(dayMap)) {
      if (normalized.includes(name)) {
        targetDay = day;
        break;
      }
    }

    if (normalized.includes('hoy')) targetDay = now.getDay();
    if (normalized.includes('mañana') || normalized.includes('manana')) {
      targetDay = (now.getDay() + 1) % 7;
    }

    const result = new Date(now);
    result.setHours(hours, minutes, 0, 0);

    if (targetDay >= 0) {
      const currentDay = now.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      result.setDate(result.getDate() + daysUntil);
    }

    if (result <= now) {
      result.setDate(result.getDate() + 1);
    }

    return result;
  }

  private isSameSchedule(proposed: Date, available: Date | null): boolean {
    if (!available) return false;

    return (
      proposed.getDay() === available.getDay() &&
      Math.abs(
        proposed.getHours() * 60 + proposed.getMinutes() -
        (available.getHours() * 60 + available.getMinutes())
      ) <= 60
    );
  }

  private isAffirmative(text: string): boolean {
    const affirmativePatterns = [
      'si', 'sí', 'dale', 'ok', 'okey', 'de acuerdo', 'bien', 'bueno',
      'perfecto', 'genial', 'joya', 'confirmado', 'me viene bien',
      'si,', 'sí,', 'dale,', 'ok,', 'okey,',
    ];
    return affirmativePatterns.some((p) => text.startsWith(p) || text === p);
  }

  private isNegative(text: string): boolean {
    const negativePatterns = [
      'no', 'nop', 'nope', 'negativo', 'no puedo', 'no me viene bien',
      'no me sirve', 'no,', 'no me queda', 'tampoco',
    ];
    return negativePatterns.some((p) => text.startsWith(p) || text === p);
  }
}

function isLocationLikeMessage(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  const coordPattern = /^(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/;
  return coordPattern.test(trimmed);
}
