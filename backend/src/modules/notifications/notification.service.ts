import { BotRole } from '@prisma/client';
import { WhatsAppAdapter, WhatsAppRole } from '../../lib/whatsapp-adapter';
import { shouldUseTemplate } from '../../utils/whatsapp-utils';
import { formatDateTimeArgentina } from '../../utils/date-utils';
import { BotRepository } from '../bot/bot.repository';

export interface ProfessionalInfo {
  phone: string;
  name: string;
}

export interface UserInfo {
  phone: string;
  name: string;
}

export interface RequestInfo {
  id: string;
  categoryName: string;
  zoneName: string;
  description: string;
  timeoutHours: number;
  photoUrls: string[];
  audioUrl?: string;
}

export interface RequestBasicInfo {
  id: string;
  categoryName: string;
  zoneName: string;
}

export class NotificationService {
  constructor(
    private readonly whatsappAdapter: WhatsAppAdapter,
    private readonly botRepository: BotRepository,
  ) {}

  async notifyProfessionalAssigned(
    professional: ProfessionalInfo,
    request: RequestInfo,
  ): Promise<void> {
    await this.notifyProfessionalWithDetails(professional.phone, request);
  }

  async notifyUserRequestAccepted(
    user: UserInfo,
    professional: ProfessionalInfo,
    request: RequestBasicInfo,
  ): Promise<void> {
    const message = `¡${professional.name} aceptó tu pedido de ${request.categoryName}! 🎉 ¿Qué día y horario te viene bien para la visita? Si necesitás cancelar, escribí "cancelar".`;

    await this.sendWithWindowCheck(
      user.phone,
      'USER',
      message,
      'nora_user_pedido_aceptado',
      [professional.name, request.categoryName],
    );
  }

  async notifyProfessionalReminder(
    professional: ProfessionalInfo,
    request: RequestBasicInfo,
  ): Promise<void> {
    const message =
      `Tenés un pedido pendiente de respuesta. ¿Podés atenderlo? Aceptalo o rechazalo desde tu panel antes de que venza el tiempo.`;

    await this.sendWithWindowCheck(
      professional.phone,
      'PROFESSIONAL',
      message,
      'nora_pro_recordatorio_pedido',
      [request.categoryName, request.zoneName],
      [
        { payload: 'ver_detalles', text: 'Ver detalles' },
        { payload: 'no_puedo', text: 'No puedo tomarlo' },
      ],
    );
  }

  async notifyProfessionalReassigned(
    professional: ProfessionalInfo,
    request: RequestInfo,
  ): Promise<void> {
    await this.notifyProfessionalWithDetails(professional.phone, request);
  }

  private async notifyProfessionalWithDetails(
    professionalPhone: string,
    request: RequestInfo,
  ): Promise<void> {
    const needsTemplate = await shouldUseTemplate(
      professionalPhone,
      'PROFESSIONAL',
      this.botRepository,
    );

    if (needsTemplate) {
      await this.whatsappAdapter.sendTemplateWithQuickReplies(
        professionalPhone,
        'nora_pro_nuevo_pedido',
        [request.categoryName, request.zoneName],
        [
          { payload: 'ver_detalles', text: 'Ver los detalles' },
          { payload: 'no_puedo', text: 'No puedo tomarlo' },
        ],
        'PROFESSIONAL',
      );
      // Photos and audio are sent after the professional asks for details.
      return;
    }

    const message = [
      `Tenés un nuevo pedido de ${request.categoryName} en ${request.zoneName}.`,
      `Descripción: ${request.description}`,
      '1. Aceptar\n2. Rechazar',
    ].join('\n\n');

    await this.sendWithWindowCheck(
      professionalPhone,
      'PROFESSIONAL',
      message,
      'nora_pro_nuevo_pedido',
      [request.categoryName, request.zoneName],
    );
    await this.sendRequestMedia(professionalPhone, request);
  }

  private async sendRequestMedia(
    phone: string,
    request: RequestInfo,
  ): Promise<void> {
    for (const photoUrl of request.photoUrls) {
      try {
        await this.whatsappAdapter.sendImage(phone, photoUrl, 'PROFESSIONAL');
      } catch (err) {
        console.error('[NotificationService] Failed to send request photo:', err);
      }
    }

    if (!request.audioUrl) {
      return;
    }

    try {
      await this.whatsappAdapter.sendAudio(
        phone,
        request.audioUrl,
        'PROFESSIONAL',
      );
    } catch (err) {
      console.error('[NotificationService] Failed to send request audio:', err);
    }
  }

  async notifyUserNoResponse(user: UserInfo): Promise<void> {
    const message =
      'No encontramos un profesional disponible para tu pedido en este momento. Podés intentarlo nuevamente más tarde.';

    await this.sendWithWindowCheck(
      user.phone,
      'USER',
      message,
      'nora_user_sin_profesional',
      [],
    );
  }

  async notifyProfessionalCancelledByUser(
    professional: ProfessionalInfo,
    hasConfirmedVisit: boolean,
    scheduledAt: Date | null,
  ): Promise<void> {
    if (hasConfirmedVisit && scheduledAt) {
      const formattedDate = formatDateTimeArgentina(scheduledAt);
      const message = `El usuario canceló la visita del ${formattedDate}. Quedás disponible para nuevas asignaciones.`;

      await this.sendWithWindowCheck(
        professional.phone,
        'PROFESSIONAL',
        message,
        'nora_pro_usuario_cancelo_visita',
        [formattedDate],
      );
    } else {
      const message =
        'El usuario canceló su pedido. Quedás disponible para nuevas asignaciones. ¡Gracias por tu disposición! 👍';

      await this.sendWithWindowCheck(
        professional.phone,
        'PROFESSIONAL',
        message,
        'nora_pro_usuario_cancelo_pedido',
        [],
      );
    }
  }

  async notifyUserProfessionalCancelled(
    user: UserInfo,
    message: string,
    hadConfirmedVisit: boolean,
    scheduledAt: Date | null,
    professionalName: string,
    categoryName: string,
  ): Promise<void> {
    if (hadConfirmedVisit && scheduledAt) {
      const formattedDate = formatDateTimeArgentina(scheduledAt);
      await this.sendWithWindowCheck(
        user.phone,
        'USER',
        message,
        'nora_user_pro_cancelo_visita',
        [professionalName, categoryName, formattedDate],
      );
    } else {
      await this.sendWithWindowCheck(
        user.phone,
        'USER',
        message,
        'nora_user_pro_cancelo_pedido',
        [professionalName, categoryName],
      );
    }
  }

  private async sendWithWindowCheck(
    phone: string,
    role: WhatsAppRole,
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
      console.error(`[NotificationService] Failed to send to ${phone} (${role}):`, err);
    }
  }

}
