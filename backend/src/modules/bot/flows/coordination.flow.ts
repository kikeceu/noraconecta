import { FlowContext, FlowHandler, FlowStepResult } from './types';
import prisma from '../../../lib/prisma';

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

    if (role === 'USER' && message.text?.trim()) {
      const availability = message.text.trim();

      const request = await prisma.request.update({
        where: { id: requestId },
        data: {
          coordinationStatus: 'AWAITING_CONFIRMATION',
          clientAddress: availability,
        },
        include: {
          user: { select: { name: true, phone: true } },
          assignedProfessional: { select: { name: true, phone: true } },
          category: { select: { name: true } },
        },
      });

      const professionalName = request.assignedProfessional?.name || 'El profesional';

      const professionalMessage = `Tu cliente ${request.user?.name || 'el usuario'} puede ${availability}. ¿Confirmás un horario?`;

      return {
        response: {
          text: `Le aviso a ${professionalName} que podés ${availability}. Esperá su confirmación.`,
        },
        nextStep: null,
        tempData: {
          requestId,
          availability,
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

    return {
      response: {
        text: `¡Buenas noticias! ${professionalName} aceptó tu pedido de ${categoryName}. ¿Qué días y horarios tenés disponibles para la visita?`,
      },
      nextStep: 'AWAITING_AVAILABILITY',
      tempData,
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
      const scheduledAt = this.parseScheduleDate(scheduleText);

      if (!scheduledAt) {
        return {
          response: {
            text: 'No pude interpretar la fecha y hora. ¿Podés indicarme el día y horario? (Ej: "martes a las 10 de la mañana" o "lunes 14hs")',
          },
          nextStep: 'AWAITING_CONFIRMATION',
          tempData,
        };
      }

      await prisma.request.update({
        where: { id: requestId },
        data: {
          coordinationStatus: 'AWAITING_LOCATION',
          scheduledAt,
        },
      });

      const userName = tempData.userName as string;
      const professionalName = tempData.professionalName as string;

      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const dayName = dayNames[scheduledAt.getDay()];
      const hours = scheduledAt.getHours().toString().padStart(2, '0');
      const minutes = scheduledAt.getMinutes().toString().padStart(2, '0');

      const userMessage = `${professionalName} llega el ${dayName} a las ${hours}:${minutes}. Para que pueda encontrarte, respondé con tu dirección exacta (calle, número, piso/depto, referencia de acceso) y compartí tu ubicación desde WhatsApp.`;

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
              scheduledAt: scheduledAt.toISOString(),
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
}

function isLocationLikeMessage(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  const coordPattern = /^(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/;
  return coordPattern.test(trimmed);
}
