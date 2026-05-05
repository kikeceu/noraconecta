import { BotRepository } from './bot.repository';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';

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
  constructor(private readonly botRepository: BotRepository) {}

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

        const userSession = await this.botRepository.findByPhone(userPhone);
        const userTempData = (userSession?.tempData as Record<string, unknown>) || {};

        await this.botRepository.upsert(userPhone, {
          role: 'USER',
          currentFlow: userSession?.currentFlow,
          currentStep: userSession?.currentStep,
          tempData: {
            ...userTempData,
            pendingMessage: userMessage,
          } as Prisma.InputJsonValue,
        });
      }

      if (professionalPhone) {
        const address = visit.clientAddress || 'la dirección';
        const professionalMessage = `Recordatorio: mañana a las ${hours}:${minutes} tenés visita en ${address} por el pedido #${visit.id}.`;

        const profSession = await this.botRepository.findByPhone(professionalPhone);
        const profTempData = (profSession?.tempData as Record<string, unknown>) || {};

        await this.botRepository.upsert(professionalPhone, {
          role: 'PROFESSIONAL',
          currentFlow: profSession?.currentFlow,
          currentStep: profSession?.currentStep,
          tempData: {
            ...profTempData,
            pendingMessage: professionalMessage,
          } as Prisma.InputJsonValue,
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

    const scheduledAt = this.parseScheduleDate(scheduleText);
    if (!scheduledAt) {
      throw new Error('Could not parse schedule date');
    }

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
      const dayName = dayNames[scheduledAt.getDay()];
      const hours = scheduledAt.getHours().toString().padStart(2, '0');
      const minutes = scheduledAt.getMinutes().toString().padStart(2, '0');

      const userMessage = `${professionalName} llega el ${dayName} a las ${hours}:${minutes}. Para que pueda encontrarte, respondé con tu dirección exacta (calle, número, piso/depto, referencia de acceso) y compartí tu ubicación desde WhatsApp.`;

      const userSession = await this.botRepository.findByPhone(request.user.phone);
      const userTempData = (userSession?.tempData as Record<string, unknown>) || {};

      await this.botRepository.upsert(request.user.phone, {
        role: 'USER',
        currentFlow: 'COORDINATION',
        currentStep: 'AWAITING_LOCATION',
        tempData: {
          ...userTempData,
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
          pendingMessage: userMessage,
        } as Prisma.InputJsonValue,
      });
    }
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
