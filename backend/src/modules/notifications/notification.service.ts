import { BotRole } from '@prisma/client';
import { WhatsAppAdapter, WhatsAppRole } from '../../lib/whatsapp-adapter';
import { shouldUseTemplate } from '../../utils/whatsapp-utils';
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
    const message = `¡Buenas noticias! ${professional.name} aceptó tu pedido de ${request.categoryName}. Te vamos a coordinar la visita por acá.`;

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
    _request: RequestBasicInfo,
  ): Promise<void> {
    const message =
      `Tenés un pedido pendiente de respuesta. ¿Podés atenderlo? Aceptalo o rechazalo desde tu panel antes de que venza el tiempo.`;

    await this.sendWithWindowCheck(
      professional.phone,
      'PROFESSIONAL',
      message,
      'nora_pro_recordatorio_pedido',
      [],
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
      await this.whatsappAdapter.sendTemplate(
        professionalPhone,
        'nora_pro_nuevo_pedido',
        [request.categoryName, request.zoneName],
        'PROFESSIONAL',
      );
      return;
    }

    const message = [
      `Tenés un nuevo pedido de ${request.categoryName} en ${request.zoneName}.`,
      `Descripción: ${request.description}`,
      '1. Aceptar\n2. Rechazar',
    ].join('\n\n');

    await this.send(professionalPhone, message, 'PROFESSIONAL');
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

  async notifyUserReassigning(user: UserInfo): Promise<void> {
    const message =
      'Seguimos buscando el profesional ideal para tu pedido. Te avisamos en cuanto confirmemos.';

    await this.sendWithWindowCheck(
      user.phone,
      'USER',
      message,
      'nora_user_buscando_profesional',
      [],
    );
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
    let message: string;

    if (hasConfirmedVisit && scheduledAt) {
      const date = scheduledAt.toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      message = `El usuario canceló la visita programada para el ${date}. Quedás disponible para nuevas asignaciones.`;
    } else {
      message =
        'El usuario canceló el pedido. Quedás disponible para nuevas asignaciones.';
    }

    await this.sendWithWindowCheck(
      professional.phone,
      'PROFESSIONAL',
      message,
      'nora_pro_pedido_cancelado',
      [],
    );
  }

  async notifyUserProfessionalCancelled(
    user: UserInfo,
    message: string,
  ): Promise<void> {
    await this.sendWithWindowCheck(
      user.phone,
      'USER',
      message,
      'nora_user_profesional_cancelado',
      [],
    );
  }

  private async sendWithWindowCheck(
    phone: string,
    role: WhatsAppRole,
    text: string,
    templateName: string,
    templateParams: string[],
  ): Promise<void> {
    try {
      const needsTemplate = await shouldUseTemplate(phone, role as BotRole, this.botRepository);

      if (needsTemplate) {
        await this.whatsappAdapter.sendTemplate(phone, templateName, templateParams, role);
      } else {
        await this.whatsappAdapter.sendText(phone, text, role);
      }
    } catch (err) {
      console.error(`[NotificationService] Failed to send to ${phone} (${role}):`, err);
    }
  }

  private async send(
    phone: string,
    text: string,
    role: WhatsAppRole,
  ): Promise<void> {
    try {
      await this.whatsappAdapter.sendText(phone, text, role);
    } catch (err) {
      console.error(
        `[NotificationService] Failed to send WhatsApp to ${phone} (${role}):`,
        err,
      );
    }
  }
}
