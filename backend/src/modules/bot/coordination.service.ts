import { BotRole } from '@prisma/client';
import { BotRepository } from './bot.repository';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { WhatsAppAdapter } from '../../lib/whatsapp-adapter';
import { shouldUseTemplate } from '../../utils/whatsapp-utils';
import { parseDateTimeNatural, getDayArgentina, getHoursArgentina, getMinutesArgentina, formatDateTimeArgentina } from '../../utils/date-utils';
import { ConfigRepository } from '../config/config.repository';
import { BOT_PAYLOADS } from './constants/bot-payloads';

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
      `¿Del 1 al 5, cómo lo calificás?`;

    await this.sendWithWindowCheck(
      userPhone,
      'USER',
      message,
      'nora_user_trabajo_finalizado',
      [professionalName, categoryName],
    );

    const userSession = await this.botRepository.findByPhoneAndRole(userPhone, 'USER');
    const userTempData = (userSession?.tempData as Record<string, unknown>) || {};

    await this.botRepository.upsert(userPhone, {
      role: 'USER',
      currentFlow: 'FEEDBACK',
      currentStep: 'FEEDBACK_RATING',
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

      const existingPRS = await this.botRepository.findRequestSessionByRequestId(request.id);
      const tempData = (existingPRS?.tempData as Record<string, unknown>) || {};

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
            { payload: BOT_PAYLOADS.SI_FINALICE, text: 'Sí, lo finalicé' },
            { payload: BOT_PAYLOADS.PENDIENTE, text: 'Todavía está pendiente' },
          ],
        );

        await this.botRepository.upsertRequestSession(professionalPhone, request.id, 'AWAITING_WORK_COMPLETION', {
          requestId: request.id, userId: request.userId, userPhone: request.user?.phone,
          userName, completionAttempt: 1, completionLastCheckAt: now.toISOString(),
        });
        await this.botRepository.upsert(professionalPhone, {
          role: 'PROFESSIONAL', currentFlow: 'FEEDBACK', currentStep: null, tempData: {} as Prisma.InputJsonValue,
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
            { payload: BOT_PAYLOADS.SI_FINALICE, text: 'Sí, lo finalicé' },
            { payload: BOT_PAYLOADS.NO_PUDE, text: 'No pude completarlo' },
          ],
        );

        await this.botRepository.upsertRequestSession(professionalPhone, request.id, 'AWAITING_WORK_COMPLETION', {
          ...tempData,
          requestId: request.id, userId: request.userId, userPhone: request.user?.phone,
          userName, completionAttempt: 2, completionLastCheckAt: now.toISOString(),
        });
        await this.botRepository.upsert(professionalPhone, {
          role: 'PROFESSIONAL', currentFlow: 'FEEDBACK', currentStep: null, tempData: {} as Prisma.InputJsonValue,
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

  async sendRequestMedia(phone: string, photoUrls: string[], audioUrl?: string): Promise<void> {
    for (const photoUrl of photoUrls) {
      try {
        await this.whatsappAdapter.sendImage(phone, photoUrl, 'PROFESSIONAL');
      } catch (err) {
        console.error('[CoordinationService] Failed to send request photo:', err);
      }
    }

    if (audioUrl) {
      try {
        await this.whatsappAdapter.sendAudio(phone, audioUrl, 'PROFESSIONAL');
      } catch (err) {
        console.error('[CoordinationService] Failed to send request audio:', err);
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
    categoryName?: string,
    zoneName?: string,
    securityCode?: string | null,
    scheduledAt?: Date | null,
  ): Promise<void> {
    const header = categoryName && zoneName ? `📋 ${categoryName} en ${zoneName}\n\n` : '';
    let message =
      `${header}✅ ¡Todo listo! Le confirmé la visita a ${userName}.\n` +
      `📅 ${scheduleText}\n` +
      `📍 ${address}\n` +
      `📞 ${userPhone}`;

    if (userLatitude && userLongitude) {
      const mapsUrl = `https://www.google.com/maps?q=${userLatitude},${userLongitude}`;
      message += `\n🗺️ Ver ubicación: ${mapsUrl}`;
    }

    // When the visit is scheduled within 20hs, the reminder (20-24hs window) will
    // not be triggered, so the security code must be delivered here instead.
    const hoursUntilVisit = scheduledAt
      ? (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60)
      : null;
    const isWithin20Hours = hoursUntilVisit !== null && hoursUntilVisit < 20;

    if (isWithin20Hours && securityCode) {
      message += `\n\n🔐 Código de seguridad: *${securityCode}*\nAl llegar, decile este código al cliente.`;
    }

    // If the professional has no profile photo yet, request one now and flag the
    // pending request in ProfessionalProfile.photoRequestedAt so an image reply
    // during AWAITING_VISIT gets stored as their profile picture.
    const professional = await prisma.professional.findUnique({
      where: { phone: professionalPhone },
      select: { id: true, profile: { select: { photoUrl: true } } },
    });

    if (professional && !professional.profile?.photoUrl) {
      message += `\n\n📸 Para que el usuario pueda reconocerte, necesito tu foto de perfil. Enviame una foto ahora.`;

      await prisma.professionalProfile.upsert({
        where: { professionalId: professional.id },
        update: { photoRequestedAt: new Date() },
        create: { professionalId: professional.id, photoRequestedAt: new Date() },
      });
    }

    if (userLatitude && userLongitude) {
      await this.sendWithWindowCheck(
        professionalPhone,
        'PROFESSIONAL',
        message,
        'nora_pro_visita_confirmada_ubicacion',
        [userName, scheduleText, address, userPhone],
      );
    } else {
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
    categoryName?: string,
    zoneName?: string,
  ): Promise<void> {
    const header = categoryName && zoneName ? `📋 ${categoryName} en ${zoneName}\n\n` : '';
    await this.sendWithWindowCheck(
      professionalPhone,
      'PROFESSIONAL',
      `${header}¡${userName} aceptó el ${dayName} a las ${hours}:${minutes}! La visita quedó confirmada.`,
      'nora_pro_cliente_acepto_horario',
      [userName, dayName, `${hours}:${minutes}`],
    );
  }

  async sendReminders(): Promise<number> {
    const now = new Date();

    const argHour = getHoursArgentina(now);
    if (argHour < 8 || argHour >= 21) {
      return 0;
    }

    const reminderStart = new Date(now.getTime() + 20 * 60 * 60 * 1000);
    const reminderEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const minCoordinationAge = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const visits = await prisma.request.findMany({
      where: {
        coordinationStatus: 'SCHEDULED',
        scheduledAt: {
          gte: reminderStart,
          lt: reminderEnd,
        },
        reminderSentAt: null,
        updatedAt: { lte: minCoordinationAge },
      },
      include: {
        user: { select: { name: true, phone: true } },
        assignedProfessional: { select: { id: true, name: true, phone: true } },
        category: { select: { name: true } },
      },
    });

    let sent = 0;

    for (const visit of visits) {
      if (!visit.scheduledAt) continue;

      const scheduledAt = visit.scheduledAt;
      const hours = getHoursArgentina(scheduledAt).toString().padStart(2, '0');
      const minutes = getMinutesArgentina(scheduledAt).toString().padStart(2, '0');

      const professionalName = visit.assignedProfessional?.name || 'El profesional';
      const userPhone = visit.user?.phone;
      const professionalPhone = visit.assignedProfessional?.phone;
      const professionalId = visit.assignedProfessional?.id;

      const securityCode = visit.securityCode;

      const professionalProfile = professionalId
        ? await prisma.professionalProfile.findUnique({
            where: { professionalId },
            select: { photoUrl: true },
          })
        : null;

      const profileLink = professionalProfile?.photoUrl && professionalId
        ? `${process.env.APP_URL || 'https://app.noraconecta.com'}/pro/${professionalId}`
        : null;

      await prisma.request.update({
        where: { id: visit.id },
        data: { reminderSentAt: now },
      });

      if (userPhone) {
        const categoryName = visit.category?.name || 'el servicio';
        let userMessage = `Recordatorio: ${professionalName} visita tu domicilio mañana a las ${hours}:${minutes}.`;
        if (securityCode) {
          userMessage += `\n\n🔐 Código de seguridad: *${securityCode}*\nCuando llegue, pedile este código para confirmar su identidad.`;
        }
        if (profileLink) {
          userMessage += `\n\n👤 Conocé a tu profesional: ${profileLink}`;
        }
        userMessage += `\n\n1. Confirmo\n2. Necesito cancelar`;
	
	const userTemplateName = profileLink
	  ? 'nora_user_visita_recordatorio_con_foto'
	  : 'nora_user_visita_recordatorio';

	const userTemplateParams = profileLink
	  ? [professionalName, categoryName, `${hours}:${minutes}`, securityCode ?? '', profileLink]
	  : [professionalName, categoryName, `${hours}:${minutes}`, securityCode ?? ''];

        await this.sendWithWindowCheck(
          userPhone,
          'USER',
          userMessage,
          userTemplateName,
          userTemplateParams,
          [
            { payload: BOT_PAYLOADS.CONFIRMO_VISITA_USER, text: 'Confirmo' },
            { payload: BOT_PAYLOADS.CANCELAR_VISITA, text: 'Necesito cancelar' },
          ],
        );

        await this.botRepository.upsert(userPhone, {
          role: 'USER',
          currentFlow: 'COORDINATION',
          currentStep: 'AWAITING_VISIT_CONFIRMATION',
          tempData: {
            requestId: visit.id,
            userId: visit.userId,
            userName: visit.user?.name,
            professionalId: visit.assignedProfessionalId,
            professionalName: visit.assignedProfessional?.name,
            professionalPhone: visit.assignedProfessional?.phone,
            scheduledAt: visit.scheduledAt?.toISOString(),
          } as Prisma.InputJsonValue,
        });
      }

      if (professionalPhone) {
        const address = visit.clientAddress || 'la dirección';
        const userName = visit.user?.name || 'el usuario';
        const categoryName = visit.category?.name || 'el servicio';
        let professionalMessage = `📋 ${categoryName}\n\nRecordatorio: mañana a las ${hours}:${minutes} tenés visita en ${address}.`;
        if (securityCode) {
          professionalMessage += `\n\n🔐 Código de seguridad: *${securityCode}*\nAl llegar, decile este código al cliente.`;
        }
        professionalMessage += '\n\n1. Confirmo\n2. No puedo ir';

        await this.sendWithWindowCheck(
          professionalPhone,
          'PROFESSIONAL',
          professionalMessage,
          'nora_pro_visita_recordatorio',
          [`${hours}:${minutes}`, userName, address, securityCode ?? ''],
          [
            { payload: BOT_PAYLOADS.CONFIRMO_VISITA, text: 'Confirmo' },
            { payload: BOT_PAYLOADS.NO_PUEDO_IR, text: 'No puedo ir' },
          ],
        );

        await this.botRepository.upsertRequestSession(professionalPhone, visit.id, 'AWAITING_VISIT_CONFIRMATION', {
          requestId: visit.id, professionalId: visit.assignedProfessionalId,
          userPhone: visit.user?.phone, userName: visit.user?.name,
          scheduledAt: visit.scheduledAt?.toISOString(),
        });
        await this.botRepository.upsert(professionalPhone, {
          role: 'PROFESSIONAL', currentFlow: 'COORDINATION', currentStep: null, tempData: {} as Prisma.InputJsonValue,
        });
      }

      sent++;
    }

    return sent;
  }

  async confirmVisit(requestId: string, scheduleText: string): Promise<void> {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        coordinationStatus: true,
        clientAvailability: true,
        userId: true,
        userLatitude: true,
        assignedProfessionalId: true,
        description: true,
        user: { select: { name: true, phone: true } },
        assignedProfessional: { select: { name: true, phone: true } },
        category: { select: { name: true } },
        geoNode: { select: { name: true } },
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

    const scheduleResult = await parseDateTimeNatural(scheduleText, new Date());

    if (!scheduleResult.success) {
      const errorText = scheduleResult.reason === 'past'
        ? 'La fecha que indicaste ya pasó. Indicá una fecha futura. Por ejemplo: *viernes 13/06 a las 16:00*'
        : 'No pude interpretar la fecha y hora. Indicá ambos datos. Por ejemplo: *viernes 13/06 a las 16:00*';

      console.log('[CoordinationService.confirmVisit] Could not parse schedule, resetting to AWAITING_AVAILABILITY');
      await prisma.request.update({
        where: { id: requestId },
        data: {
          coordinationStatus: 'AWAITING_AVAILABILITY',
          clientAvailability: null,
        },
      });

      if (request.user?.phone) {
        await this.whatsappAdapter.sendText(
          request.user.phone,
          errorText,
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

    const scheduledAt = scheduleResult.date;

    console.log('[CoordinationService.confirmVisit] Parsed schedule:', {
      scheduleText,
      scheduledAt: scheduledAt.toISOString(),
    });

    const clientAvailability = request.clientAvailability ?? undefined;

    let userProposedAt: Date | null = null;
    if (clientAvailability) {
      const availabilityResult = await parseDateTimeNatural(clientAvailability, new Date());
      if (availabilityResult.success) {
        userProposedAt = availabilityResult.date;
      }
    }

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
            { payload: BOT_PAYLOADS.SI_ME_VIENE, text: 'Sí, me viene bien' },
            { payload: BOT_PAYLOADS.NO_ME_VIENE, text: 'No' },
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

      const needsGps = !request.userLatitude;
      const zoneName = request.geoNode?.name || 'tu zona';

      const userMessage = needsGps
        ? `Para que ${professionalName} pueda encontrarte fácilmente en ${zoneName}, compartí tu ubicación por WhatsApp. Si no querés compartirla, escribí "no".`
        : `¡Buenas noticias! ${professionalName}, tu ${categoryName}, confirmó la visita para el ${dayName} a las ${hours2}:${minutes2}. Para que pueda encontrarte, indicanos tu dirección exacta.`;

      const targetStep = needsGps ? 'AWAITING_GPS' : 'AWAITING_LOCATION';

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
        currentStep: targetStep,
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

  async notifyUserNegotiationExhausted(
    userPhone: string,
    professionalName: string,
    reassigned: boolean,
  ): Promise<void> {
    const message = reassigned
      ? `No pudimos coordinar un horario con ${professionalName}. Ya le asignamos tu pedido a otro profesional — te avisamos cuando confirme.\n\n1. Seguir esperando\n2. Cancelar mi pedido`
      : `No pudimos coordinar un horario con ${professionalName} y no hay otros profesionales disponibles en tu zona por ahora.\n\n1. Avisame cuando haya uno disponible\n2. Cancelar mi pedido`;

    const templateName = reassigned
      ? 'nora_user_reasignando_por_negociacion'
      : 'nora_user_sin_profesional_negociacion';

    await this.sendWithWindowCheck(
      userPhone,
      'USER',
      message,
      templateName,
      [professionalName],
    );
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
