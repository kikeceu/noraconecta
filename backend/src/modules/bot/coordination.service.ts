import { BotRole } from '@prisma/client';
import { BotRepository } from './bot.repository';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { WhatsAppAdapter } from '../../lib/whatsapp-adapter';
import { shouldUseTemplate } from '../../utils/whatsapp-utils';
import { parseExactDate, getDayArgentina, getHoursArgentina, getMinutesArgentina, formatDateTimeArgentina } from '../../utils/date-utils';
import { ConfigRepository } from '../config/config.repository';

const DEFAULT_WORK_COMPLETION_CHECK_HOURS = 24;

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
    private readonly configRepository = new ConfigRepository(),
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
        category: { select: { name: true } },
      },
    });

    if (!request) return;

    const userPhone = request.user?.phone;
    if (!userPhone) return;

    const professionalName = request.assignedProfessional?.name || 'El profesional';
    const categoryName = request.category?.name || 'el servicio';

    const message =
      `${professionalName}, tu ${categoryName}, indicó que finalizó el trabajo.\n` +
      `¿Cómo te fue?\n\n` +
      `1. Conforme\n2. Con observaciones\n3. No conforme`;

    await this.sendWithWindowCheck(
      userPhone,
      'USER',
      message,
      'nora_user_trabajo_finalizado',
      [professionalName, categoryName],
      [
        { payload: 'conforme_btn', text: 'Conforme' },
        { payload: 'observaciones_btn', text: 'Con observaciones' },
        { payload: 'no_conforme_btn', text: 'No conforme' },
      ],
    );

    const userSession = await this.botRepository.findByPhoneAndRole(userPhone, 'USER');
    const userTempData = (userSession?.tempData as Record<string, unknown>) || {};

    await this.botRepository.upsert(userPhone, {
      role: 'USER',
      currentFlow: 'FEEDBACK',
      currentStep: 'FEEDBACK_SATISFACTION',
      tempData: {
        ...userTempData,
        requestId,
        userId: request.userId,
        userPhone,
        userName: request.user?.name,
        professionalName,
      } as Prisma.InputJsonValue,
    });
  }

  async checkWorkCompletion(): Promise<void> {
    const hours = await this.getWorkCompletionCheckHours();
    const now = new Date();
    const firstCheckThreshold = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const requests = await prisma.request.findMany({
      where: {
        status: 'ACCEPTED',
        coordinationStatus: 'SCHEDULED',
        scheduledAt: { lte: firstCheckThreshold },
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        assignedProfessional: {
          select: {
            id: true,
            name: true,
            phone: true,
            sessionToken: true,
            sessionTokenExp: true,
          },
        },
      },
    });


    for (const request of requests) {
      const professionalPhone = request.assignedProfessional?.phone;
      const professionalId = request.assignedProfessional?.id;

      if (!professionalPhone || !professionalId) {
        continue;
      }

      const session = await this.botRepository.findByPhoneAndRole(professionalPhone, 'PROFESSIONAL');
      const tempData = (session?.tempData as Record<string, unknown>) || {};
      const sessionRequestId = typeof tempData.requestId === 'string' ? tempData.requestId : null;

      if (
        session?.currentFlow === 'FEEDBACK' &&
        session?.currentStep === 'AWAITING_WORK_COMPLETION' &&
        sessionRequestId &&
        sessionRequestId !== request.id
      ) {
        continue;
      }

      const completionAttemptRaw = tempData.completionAttempt;
      const completionAttempt =
        typeof completionAttemptRaw === 'number'
          ? completionAttemptRaw
          : Number.isFinite(Number(completionAttemptRaw))
            ? Number(completionAttemptRaw)
            : 0;

      const lastCheckAtRaw = tempData.completionLastCheckAt;
      const lastCheckAt =
        typeof lastCheckAtRaw === 'string' && !Number.isNaN(Date.parse(lastCheckAtRaw))
          ? new Date(lastCheckAtRaw)
          : null;

      const nextAttemptAt = lastCheckAt
        ? new Date(lastCheckAt.getTime() + hours * 60 * 60 * 1000)
        : null;
      const canRetry = !nextAttemptAt || now >= nextAttemptAt;

      const address = request.clientAddress || 'la dirección';
      const userName = request.user?.name || 'el usuario';

      if (completionAttempt <= 0) {
        await this.sendWithWindowCheck(
          professionalPhone,
          'PROFESSIONAL',
          `¡Hola ${userName}! ¿Cómo te fue con el trabajo en ${address}? ¿Pudiste terminarlo?\n1. Sí, lo finalicé\n2. Todavía está pendiente`,
          'nora_pro_check_finalizacion',
          [address, userName],
          [
            { payload: 'si_finalice', text: 'Sí, lo finalicé' },
            { payload: 'pendiente', text: 'Todavía está pendiente' },
          ],
        );

        await this.botRepository.upsert(professionalPhone, {
          role: 'PROFESSIONAL',
          currentFlow: 'FEEDBACK',
          currentStep: 'AWAITING_WORK_COMPLETION',
          tempData: {
            requestId: request.id,
            userId: request.userId,
            userPhone: request.user?.phone,
            userName,
            completionAttempt: 1,
            completionLastCheckAt: now.toISOString(),
          } as Prisma.InputJsonValue,
        });

        continue;
      }

      if (completionAttempt === 1) {
        if (!canRetry) {
          continue;
        }

        await this.sendWithWindowCheck(
          professionalPhone,
          'PROFESSIONAL',
          `¡Hola ${userName}! Es nuestra última consulta sobre el trabajo en ${address}. ¿Lo pudiste terminar?\n1. Sí, lo finalicé\n2. No pude completarlo`,
          'nora_pro_check_finalizacion_ultimo',
          [address, userName],
          [
            { payload: 'si_finalice', text: 'Sí, lo finalicé' },
            { payload: 'no_pude', text: 'No pude completarlo' },
          ],
        );

        await this.botRepository.upsert(professionalPhone, {
          role: 'PROFESSIONAL',
          currentFlow: 'FEEDBACK',
          currentStep: 'AWAITING_WORK_COMPLETION',
          tempData: {
            ...tempData,
            requestId: request.id,
            userId: request.userId,
            userPhone: request.user?.phone,
            userName,
            completionAttempt: 2,
            completionLastCheckAt: now.toISOString(),
          } as Prisma.InputJsonValue,
        });

        continue;
      }

      if (!canRetry) {
        continue;
      }

      const existingEscalation = await prisma.escalation.findUnique({
        where: { requestId: request.id },
        select: { id: true },
      });

      if (!existingEscalation && request.assignedProfessionalId) {
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
  }

  async sendMessageWithWindowCheck(
    phone: string,
    role: 'USER' | 'PROFESSIONAL',
    text: string,
    templateName: string,
    templateParams: string[],
  ): Promise<void> {
    await this.sendWithWindowCheck(phone, role, text, templateName, templateParams);
  }

  async notifyProfessionalVisitConfirmed(
    professionalPhone: string,
    userName: string,
    scheduleText: string,
    address: string,
    userPhone: string,
    userLatitude: number | null,
    userLongitude: number | null,
  ): Promise<void> {
    const hasCoordinates = !!(userLatitude && userLongitude);

    if (hasCoordinates) {
      const coords = `${userLatitude},${userLongitude}`;
      await this.whatsappAdapter.sendTemplateWithButton(
        professionalPhone,
        'nora_pro_visita_confirmada_ubicacion',
        [userName, scheduleText, address, userPhone],
        coords,
        'PROFESSIONAL',
      );
    } else {
      const message =
        `Visita confirmada ✅\n` +
        `Cliente: ${userName}\n` +
        `Día y hora: ${scheduleText}\n` +
        `Dirección: ${address}\n` +
        `Teléfono del cliente: ${userPhone}`;

      await this.sendWithWindowCheck(
        professionalPhone,
        'PROFESSIONAL',
        message,
        'nora_pro_visita_confirmada',
        [userName, scheduleText, address, userPhone],
      );
    }
  }

  async notifyProfessionalClientAcceptedSchedule(
    professionalPhone: string,
    userName: string,
    dayName: string,
    hours: string,
    minutes: string,
  ): Promise<void> {
    await this.sendWithWindowCheck(
      professionalPhone,
      'PROFESSIONAL',
      `¡${userName} aceptó el ${dayName} a las ${hours}:${minutes}! La visita quedó confirmada.`,
      'nora_pro_cliente_acepto_horario',
      [userName, dayName, `${hours}:${minutes}`],
    );
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
        category: { select: { name: true } },
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
        const categoryName = visit.category?.name || 'el servicio';
        const userMessage = `Recordatorio: ${professionalName} visita tu domicilio mañana a las ${hours}:${minutes}. Si necesitás reprogramar, escribime.`;

        await this.sendWithWindowCheck(
          userPhone,
          'USER',
          userMessage,
          'nora_user_visita_recordatorio',
          [professionalName, categoryName, `${hours}:${minutes}`],
        );
      }

      if (professionalPhone) {
        const address = visit.clientAddress || 'la dirección';
        const userName = visit.user?.name || 'el usuario';
        const professionalMessage =
          `Recordatorio: mañana a las ${hours}:${minutes} tenés visita en ${address}.\n` +
          '¿Confirmás? Respondé "Confirmo" o "Cancelar" si no podés asistir.';

        await this.sendWithWindowCheck(
          professionalPhone,
          'PROFESSIONAL',
          professionalMessage,
          'nora_pro_visita_recordatorio',
          [`${hours}:${minutes}`, userName, address],
          [
            { payload: 'confirmo_visita', text: 'Confirmo' },
            { payload: 'no_puedo_ir', text: 'No puedo ir' },
          ],
        );

        await this.botRepository.upsert(professionalPhone, {
          role: 'PROFESSIONAL',
          currentFlow: 'COORDINATION',
          currentStep: 'AWAITING_VISIT_CONFIRMATION',
          tempData: {
            requestId: visit.id,
            professionalId: visit.assignedProfessionalId,
            userPhone: visit.user?.phone,
            userName: visit.user?.name,
            scheduledAt: visit.scheduledAt?.toISOString(),
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

        await this.whatsappAdapter.sendText(
          request.user.phone,
          userMessage,
          'USER',
        );

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
        const categoryName = request.category?.name || 'el servicio';
        const availability = clientAvailability || 'ese horario';

        const alternativeText = formatDateTimeArgentina(scheduledAt);

        const userMessage = `${professionalName}, tu ${categoryName}, no puede ${availability}. Propone el ${alternativeText}. ¿Te viene bien?\n1. Sí\n2. No`;

        await this.sendWithWindowCheck(
          request.user.phone,
          'USER',
          userMessage,
          'nora_user_horario_alternativo',
          [professionalName, categoryName, alternativeText],
          [
            { payload: 'si_me_viene', text: 'Sí, me viene bien' },
            { payload: 'no_me_viene', text: 'No' },
          ],
        );

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
      const categoryName = request.category?.name || 'el servicio';

      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const dayName = dayNames[getDayArgentina(scheduledAt)];
      const hours2 = getHoursArgentina(scheduledAt).toString().padStart(2, '0');
      const minutes2 = getMinutesArgentina(scheduledAt).toString().padStart(2, '0');

      const userMessage = `¡Buenas noticias! ${professionalName}, tu ${categoryName}, confirmó la visita para el ${dayName} a las ${hours2}:${minutes2}. Para que pueda encontrarte, indicanos tu dirección exacta.`;

      await this.sendWithWindowCheck(
        request.user.phone,
        'USER',
        userMessage,
        'nora_user_visita_confirmada',
        [professionalName, categoryName, dayName, `${hours2}:${minutes2}`],
      );

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

  private async sendWithWindowCheck(
    phone: string,
    role: 'USER' | 'PROFESSIONAL',
    text: string,
    templateName: string,
    templateParams: string[],
    buttons?: Array<{ payload: string; text?: string }>,
  ): Promise<void> {
    try {
      const needsTemplate = await shouldUseTemplate(phone, role as BotRole, this.botRepository);

      if (needsTemplate) {
        if (buttons) {
          await this.whatsappAdapter.sendTemplateWithQuickReplies(phone, templateName, templateParams, buttons, role);
        } else {
          await this.whatsappAdapter.sendTemplate(phone, templateName, templateParams, role);
        }
      } else {
        await this.whatsappAdapter.sendText(phone, text, role);
      }
    } catch (err) {
      console.error(`[CoordinationService] Failed to send to ${phone} (${role}):`, err);
    }
  }

  private async getWorkCompletionCheckHours(): Promise<number> {
    const config = await this.configRepository.findByKey('WORK_COMPLETION_CHECK_HOURS');
    const parsed = config ? Number.parseInt(config.value, 10) : NaN;

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_WORK_COMPLETION_CHECK_HOURS;
    }

    return parsed;
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
