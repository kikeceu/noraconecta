import { BotRole } from '@prisma/client';
import { WhatsAppAdapter, WhatsAppRole } from '../../lib/whatsapp-adapter';
import { shouldUseTemplate } from '../../utils/whatsapp-utils';
import { formatDateTimeArgentina } from '../../utils/date-utils';
import { BotRepository } from '../bot/bot.repository';
import { BOT_PAYLOADS } from '../bot/constants/bot-payloads';
import {
  TEMPLATE_USER_DESCRIPCION_NO_RELACIONADA,
  TEMPLATE_USER_CONFIRMAR_SERVICIO,
  TEMPLATE_USER_CANCELAR_PEDIDO,
  TEMPLATE_PRO_NUEVO_PEDIDO_SIN_MEDIA,
} from '../../utils/whatsapp-templates';

export interface ProfessionalInfo {
  phone: string;
  name: string;
  licenseStatus?: string | null;
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
  technicalBrief?: string | null;
}

const MAX_BRIEF_LENGTH = 800;

function buildBriefParam(technicalBrief: string | null | undefined): string {
  if (!technicalBrief || technicalBrief.trim() === '') {
    return 'Sin detalles adicionales del problema.';
  }
  return technicalBrief.length > MAX_BRIEF_LENGTH
    ? technicalBrief.substring(0, MAX_BRIEF_LENGTH) + '...'
    : technicalBrief;
}

export interface RequestBasicInfo {
  id: string;
  categoryName: string;
  zoneName: string;
  requiresLicense?: boolean;
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
    const licenseBadge =
      request.requiresLicense && professional.licenseStatus === 'APPROVED'
        ? '\n✓ Profesional matriculado'
        : '';

    const message = `¡${professional.name} aceptó tu pedido de ${request.categoryName}!${licenseBadge} 🎉 ¿Qué día y horario te viene bien para la visita? Si necesitás cancelar, escribí "cancelar".`;

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
        { payload: BOT_PAYLOADS.VER_DETALLES, text: 'Ver detalles' },
        { payload: BOT_PAYLOADS.NO_PUEDO, text: 'No puedo tomarlo' },
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
    const hasMedia = request.photoUrls.length > 0 || !!request.audioUrl;
    const needsTemplate = await shouldUseTemplate(
      professionalPhone,
      'PROFESSIONAL',
      this.botRepository,
    );

    const templateName = hasMedia
      ? 'nora_pro_nuevo_pedido'
      : TEMPLATE_PRO_NUEVO_PEDIDO_SIN_MEDIA;

    const templateParams: string[] = [
      request.categoryName,
      request.zoneName,
      buildBriefParam(request.technicalBrief),
    ];

    if (needsTemplate) {
      if (hasMedia) {
        await this.whatsappAdapter.sendTemplateWithQuickReplies(
          professionalPhone,
          templateName,
          templateParams,
          [
            { payload: BOT_PAYLOADS.VER_DETALLES, text: 'Ver los detalles' },
            { payload: BOT_PAYLOADS.NO_PUEDO, text: 'No puedo tomarlo' },
          ],
          'PROFESSIONAL',
        );
      } else {
        await this.whatsappAdapter.sendTemplateWithQuickReplies(
          professionalPhone,
          templateName,
          templateParams,
          [
            { payload: 'aceptar_pedido', text: 'Aceptar' },
            { payload: BOT_PAYLOADS.NO_PUEDO, text: 'Ahora no puedo' },
          ],
          'PROFESSIONAL',
        );
      }
      // Photos and audio are sent after the professional asks for details.
      return;
    }

    if (hasMedia) {
      const briefSection = request.technicalBrief
        ? `\n\n📋 ${request.technicalBrief.substring(0, MAX_BRIEF_LENGTH)}`
        : '';

      const message = `Tenés un nuevo pedido de ${request.categoryName} en ${request.zoneName}.${briefSection}\n\n¿Lo tomás?\n1. Ver los detalles\n2. Ahora no puedo`;

      await this.sendWithWindowCheck(
        professionalPhone,
        'PROFESSIONAL',
        message,
        templateName,
        templateParams,
      );
    } else {
      const briefSection = request.technicalBrief
        ? `\n\n📋 ${request.technicalBrief.substring(0, MAX_BRIEF_LENGTH)}`
        : '';

      const message = `Hay un pedido de ${request.categoryName} en ${request.zoneName} esperándote.${briefSection}\n\n¿Lo tomás?\n1. Aceptar\n2. Ahora no puedo`;

      await this.sendWithWindowCheck(
        professionalPhone,
        'PROFESSIONAL',
        message,
        templateName,
        templateParams,
      );
    }
    // Photos and audio are sent after the professional asks for details.
  }

  async notifyUserNoResponse(user: UserInfo): Promise<void> {
    const message =
      'No encontramos un profesional disponible para tu pedido en este momento. Podés intentarlo nuevamente más tarde.\n\n1. Sí, avisame\n2. Por ahora no, gracias';

    await this.sendWithWindowCheck(
      user.phone,
      'USER',
      message,
      'nora_user_sin_profesional',
      [],
      [
        { payload: BOT_PAYLOADS.NOTIFY_WHEN_AVAILABLE, text: 'Sí, avisame' },
        { payload: BOT_PAYLOADS.NO_NOTIFY, text: 'Por ahora no' },
      ],
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

  async notifyUserDescriptionMismatch(
    phone: string,
    categoryName: string,
  ): Promise<void> {
    const message = `Lo que describís no parece relacionado con un servicio de ${categoryName}. ¿Qué querés hacer?\n1. Cambiar el servicio\n2. Reformular la descripción`;

    await this.sendWithWindowCheck(
      phone,
      'USER',
      message,
      TEMPLATE_USER_DESCRIPCION_NO_RELACIONADA,
      [categoryName],
      [
        { payload: BOT_PAYLOADS.CAMBIAR_SERVICIO, text: 'Cambiar el servicio' },
        { payload: BOT_PAYLOADS.REFORMULAR_DESCRIPCION, text: 'Reformular descripción' },
      ],
    );
  }

  async notifyUserConfirmService(
    phone: string,
    categoryName: string,
  ): Promise<void> {
    const message = `Antes de continuar, ¿tu problema está relacionado con un servicio de ${categoryName}?\n1. Sí, es correcto\n2. Cambiar el servicio`;

    await this.sendWithWindowCheck(
      phone,
      'USER',
      message,
      TEMPLATE_USER_CONFIRMAR_SERVICIO,
      [categoryName],
      [
        { payload: BOT_PAYLOADS.SI_CORRECTO, text: 'Sí, es correcto' },
        { payload: BOT_PAYLOADS.CAMBIAR_SERVICIO, text: 'Cambiar el servicio' },
      ],
    );
  }

  async notifyUserCancelConfirmation(
    phone: string,
    categoryName: string,
  ): Promise<void> {
    const message = `¿Confirmás que querés cancelar tu pedido de ${categoryName}?\n1. Sí, cancelar\n2. No, seguir con el pedido`;

    await this.sendWithWindowCheck(
      phone,
      'USER',
      message,
      TEMPLATE_USER_CANCELAR_PEDIDO,
      [categoryName],
      [
        { payload: 'cancelar_pedido', text: 'Sí, cancelar' },
        { payload: 'no_cancelar', text: 'No, seguir' },
      ],
    );
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
