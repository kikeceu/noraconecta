import { BotRepository } from './bot.repository';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { WhatsAppAdapter } from '../../lib/whatsapp-adapter';
import { parseExactDate, getDayArgentina, getHoursArgentina, getMinutesArgentina, formatDateTimeArgentina } from '../../utils/date-utils';

export type CoordinationInitData = {
  requestId: string;
  userId: string;
  userName: string;
  userPhone: string;
  professionalId: string;
  professionalName: string;
  professionalPhone: string;
  categoryName: string;
  description: string;
};

export class CoordinationService {
  constructor(
    private readonly botRepository: BotRepository,
    private readonly whatsappAdapter: WhatsAppAdapter,
  ) {}

  async initAfterAccept(data: CoordinationInitData): Promise<void> {
    const tempData: Record<string, unknown> = {
      requestId: data.requestId,
      userId: data.userId,
      userName: data.userName,
      userPhone: data.userPhone,
      professionalId: data.professionalId,
      professionalName: data.professionalName,
      professionalPhone: data.professionalPhone,
      categoryName: data.categoryName,
      description: data.description,
    };

    await Promise.all([
      prisma.request.update({
        where: { id: data.requestId },
        data: { coordinationStatus: 'AWAITING_AVAILABILITY' },
      }),
      this.botRepository.upsert(data.userPhone, {
        role: 'USER',
        currentFlow: 'COORDINATION',
        currentStep: 'AWAITING_AVAILABILITY',
        tempData: tempData as Prisma.InputJsonValue,
      }),
    ]);
  }

  async notifyWorkFinished(requestId: string): Promise<void> {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { name: true, phone: true } },
        assignedProfessional: { select: { name: true } },
      },
    });

    if (!request) return;

    const userPhone = request.user?.phone;
    if (!userPhone) return;

    const professionalName = request.assignedProfessional?.name || 'El profesional';

    const message =
      `El profesional ${professionalName} indicó que finalizó el trabajo.\n` +
      `¿Cómo quedó?\n\n` +
      `Respondé: "conforme", "con observaciones" o "no conforme"`;

    await this.whatsappAdapter.sendText(userPhone, message, 'USER').catch((err) => {
      console.error('[CoordinationService] Failed to notify work finished:', err);
    });

    const userSession = await this.botRepository.findByPhoneAndRole(userPhone, 'USER');
    const userTempData = (userSession?.tempData as Record<string, unknown>) || {};

    await this.botRepository.upsert(userPhone, {
      role: 'USER',
      currentFlow: null,
      currentStep: null,
      tempData: {
        ...userTempData,
        requestId,
        userId: request.userId,
      } as Prisma.InputJsonValue,
    });
  }

  async sendReminders(): Promise<number> {
    const now = new Date();

    const reminderStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const reminderEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const visits = await prisma.request.findMany({
      where: {
        coordinationStatus: 'SCHEDULED',
        scheduledAt: {
          gte: reminderStart,
          lt: reminderEnd,
        },
      },
      include: {
        user: { select: { name: true, phone: true } },
        assignedProfessional: { select: { name: true, phone: true } },
      },
    });

    let sent = 0;

    for (const visit of visits) {
      if (!visit.scheduledAt) continue;

      const scheduledAt = visit.scheduledAt;
      const hours = scheduledAt.getHours().toString().padStart(2, '0');
      const minutes = scheduledAt.getMinutes().toString().padStart(2, '0');

      const professionalName = visit.assignedProfessional?.name || 'El profesional';
      const userPhone = visit.user?.phone;
      const professionalPhone = visit.assignedProfessional?.phone;

      if (userPhone) {
        const userMessage = `Recordatorio: ${professionalName} visita tu domicilio mañana a las ${hours}:${minutes}. Si necesitás reprogramar, escribime.`;

        await this.whatsappAdapter.sendText(userPhone, userMessage, 'USER').catch((err) => {
          console.error('[CoordinationService] Failed to send reminder to user:', err);
        });
      }

      if (professionalPhone) {
        const address = visit.clientAddress || 'la dirección';
        const professionalMessage = `Recordatorio: mañana a las ${hours}:${minutes} tenés visita en ${address} por el pedido #${visit.id}.`;

        await this.whatsappAdapter.sendText(professionalPhone, professionalMessage, 'PROFESSIONAL').catch((err) => {
          console.error('[CoordinationService] Failed to send reminder to professional:', err);
        });
      }

      sent++;
    }

    return sent;
  }

  async confirmVisit(requestId: string, scheduleText: string): Promise<void> {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { name: true, phone: true } },
        assignedProfessional: { select: { name: true, phone: true } },
        category: { select: { name: true } },
      },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'ACCEPTED' || request.coordinationStatus !== 'AWAITING_CONFIRMATION') {
      throw new Error('Request is not awaiting confirmation');
    }

    console.log('[CoordinationService.confirmVisit] Received schedule:', {
      requestId,
      scheduleText,
      clientAvailability: request.clientAvailability,
    });

    const scheduledAt = parseExactDate(scheduleText);

    if (!scheduledAt) {
      console.log('[CoordinationService.confirmVisit] Could not parse schedule, resetting to AWAITING_AVAILABILITY');
      await prisma.request.update({
        where: { id: requestId },
        data: {
          coordinationStatus: 'AWAITING_AVAILABILITY',
          clientAvailability: null,
        },
      });

      if (request.user?.phone) {
        const userMessage =
          'El formato no es válido. Escribí así: DD/MM HH:MM (ejemplo: 20/06 16:00)';

        await this.whatsappAdapter.sendText(request.user.phone, userMessage, 'USER').catch((err) => {
          console.error('[CoordinationService] Failed to send format error to user:', err);
        });

        await this.botRepository.upsert(request.user.phone, {
          role: 'USER',
          currentFlow: 'COORDINATION',
          currentStep: 'AWAITING_AVAILABILITY',
          tempData: {
            requestId,
            userId: request.userId,
            userName: request.user?.name,
            userPhone: request.user.phone,
            professionalId: request.assignedProfessionalId,
            professionalName: request.assignedProfessional?.name || 'El profesional',
            professionalPhone: request.assignedProfessional?.phone,
            categoryName: request.category?.name,
            description: request.description,
            negotiationRounds: 0,
          } as Prisma.InputJsonValue,
        });
      }

      return;
    }

    console.log('[CoordinationService.confirmVisit] Parsed schedule:', {
      scheduleText,
      scheduledAt: scheduledAt.toISOString(),
    });

    const clientAvailability = request.clientAvailability ?? undefined;
    const userProposedAt = clientAvailability ? parseExactDate(clientAvailability) : null;

    const isAlternative = !userProposedAt || !isSameSchedule(scheduledAt, userProposedAt);

    console.log('[CoordinationService.confirmVisit] Alternative detection:', {
      requestId,
      userProposedAt: userProposedAt?.toISOString() ?? null,
      scheduledAt: scheduledAt.toISOString(),
      isAlternative,
    });

    if (isAlternative) {
      await prisma.request.update({
        where: { id: requestId },
        data: {
          coordinationStatus: 'AWAITING_USER_CONFIRMATION',
          scheduledAt,
        },
      });

      console.log('[CoordinationService.confirmVisit] Alternative schedule → AWAITING_USER_CONFIRMATION');

      if (request.user?.phone) {
        const professionalName = request.assignedProfessional?.name || 'El profesional';
        const availability = clientAvailability || 'ese horario';

        const alternativeText = formatDateTimeArgentina(scheduledAt);

        const userMessage = `${professionalName} no puede ${availability}. Propone el ${alternativeText}. ¿Te viene bien? (Sí / No)`;

        await this.whatsappAdapter.sendText(request.user.phone, userMessage, 'USER').catch((err) => {
          console.error('[CoordinationService] Failed to send alternative schedule to user:', err);
        });

        await this.botRepository.upsert(request.user.phone, {
          role: 'USER',
          currentFlow: 'COORDINATION',
          currentStep: 'AWAITING_USER_CONFIRMATION',
          tempData: {
            requestId,
            userId: request.userId,
            userName: request.user?.name,
            userPhone: request.user.phone,
            professionalId: request.assignedProfessionalId,
            professionalName,
            professionalPhone: request.assignedProfessional?.phone,
            categoryName: request.category?.name,
            description: request.description,
            alternativeScheduledAt: scheduledAt.toISOString(),
            availability: clientAvailability,
            negotiationRounds: 0,
          } as Prisma.InputJsonValue,
        });

        console.log('[CoordinationService.confirmVisit] User notified with alternative schedule:', {
          requestId,
          userPhone: request.user.phone,
          alternativeText,
        });
      }

      return;
    }

    console.log('[CoordinationService.confirmVisit] Confirmed schedule → AWAITING_LOCATION');
    await prisma.request.update({
      where: { id: requestId },
      data: {
        coordinationStatus: 'AWAITING_LOCATION',
        scheduledAt,
      },
    });

    if (request.user?.phone) {
      const professionalName = request.assignedProfessional?.name || 'El profesional';

      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const dayName = dayNames[getDayArgentina(scheduledAt)];
      const hours = getHoursArgentina(scheduledAt).toString().padStart(2, '0');
      const minutes = getMinutesArgentina(scheduledAt).toString().padStart(2, '0');

      const userMessage = `${professionalName} llega el ${dayName} a las ${hours}:${minutes}. Para que pueda encontrarte, respondé con tu dirección exacta (calle, número, piso/depto, referencia de acceso) y compartí tu ubicación desde WhatsApp.`;

      await this.whatsappAdapter.sendText(request.user.phone, userMessage, 'USER').catch((err) => {
        console.error('[CoordinationService] Failed to send location request to user:', err);
      });

      await this.botRepository.upsert(request.user.phone, {
        role: 'USER',
        currentFlow: 'COORDINATION',
        currentStep: 'AWAITING_LOCATION',
        tempData: {
          requestId,
          userId: request.userId,
          userName: request.user?.name,
          userPhone: request.user.phone,
          professionalId: request.assignedProfessionalId,
          professionalName,
          professionalPhone: request.assignedProfessional?.phone,
          categoryName: request.category?.name,
          description: request.description,
          scheduledAt: scheduledAt.toISOString(),
        } as Prisma.InputJsonValue,
      });
    }
  }

}

function isSameSchedule(proposed: Date, available: Date | null): boolean {
  if (!available) return false;

  return (
    getDayArgentina(proposed) === getDayArgentina(available) &&
    Math.abs(
      getHoursArgentina(proposed) * 60 + getMinutesArgentina(proposed) -
      (getHoursArgentina(available) * 60 + getMinutesArgentina(available))
    ) <= 15
  );
}
