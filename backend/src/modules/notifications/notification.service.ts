import { WhatsAppAdapter, WhatsAppRole } from '../../lib/whatsapp-adapter';

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
}

export interface RequestBasicInfo {
  id: string;
  categoryName: string;
}

export class NotificationService {
  constructor(private readonly whatsappAdapter: WhatsAppAdapter) {}

  async notifyProfessionalAssigned(
    professional: ProfessionalInfo,
    request: RequestInfo,
  ): Promise<void> {
    const message = [
      `Tenés un nuevo pedido de ${request.categoryName} en ${request.zoneName}.`,
      `Descripción: ${request.description}`,
      `Tenés ${request.timeoutHours}hs para responder.`,
      '1. Aceptar\n2. Rechazar',
    ].join('\n\n');

    await this.send(professional.phone, message, 'PROFESSIONAL');
  }

  async notifyUserRequestAccepted(
    user: UserInfo,
    professional: ProfessionalInfo,
    request: RequestBasicInfo,
  ): Promise<void> {
    const message = `¡Buenas noticias! ${professional.name} aceptó tu pedido de ${request.categoryName}. Te vamos a coordinar la visita por acá.`;

    await this.send(user.phone, message, 'USER');
  }

  async notifyProfessionalReminder(
    professional: ProfessionalInfo,
    _request: RequestBasicInfo,
  ): Promise<void> {
    const message =
      `Tenés un pedido pendiente de respuesta. ¿Podés atenderlo? Aceptalo o rechazalo desde tu panel antes de que venza el tiempo.`;

    await this.send(professional.phone, message, 'PROFESSIONAL');
  }

  async notifyProfessionalReassigned(
    professional: ProfessionalInfo,
    request: RequestInfo,
  ): Promise<void> {
    const message = [
      `Tenés un nuevo pedido de ${request.categoryName} en ${request.zoneName}.`,
      `Descripción: ${request.description}`,
      `Tenés ${request.timeoutHours}hs para responder.`,
      '1. Aceptar\n2. Rechazar',
    ].join('\n\n');

    await this.send(professional.phone, message, 'PROFESSIONAL');
  }

  async notifyUserReassigning(user: UserInfo): Promise<void> {
    const message =
      'Seguimos buscando el profesional ideal para tu pedido. Te avisamos en cuanto confirmemos.';

    await this.send(user.phone, message, 'USER');
  }

  async notifyUserNoResponse(user: UserInfo): Promise<void> {
    const message =
      'No encontramos un profesional disponible para tu pedido en este momento. Podés intentarlo nuevamente más tarde.';

    await this.send(user.phone, message, 'USER');
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

    await this.send(professional.phone, message, 'PROFESSIONAL');
  }

  async notifyUserProfessionalCancelled(
    user: UserInfo,
    message: string,
  ): Promise<void> {
    await this.send(user.phone, message, 'USER');
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
