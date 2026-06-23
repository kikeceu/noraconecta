import crypto from 'crypto';
import { BotRole } from '@prisma/client';
import { PaymentsRepository } from './payments.repository';
import { MembershipsService } from '../memberships/memberships.service';
import { MatchingRepository } from '../matching/matching.repository';
import { RequestsRepository } from '../requests/requests.repository';
import { WhatsAppAdapter } from '../../lib/whatsapp-adapter';
import { BotRepository } from '../bot/bot.repository';
import { ConfigRepository } from '../config/config.repository';
import { shouldUseTemplate } from '../../utils/whatsapp-utils';
import { createPaymentLink, fetchPayment } from '../../lib/mercadopago-client';
import { MEMBERSHIP_RENEWED_TEMPLATE } from '../../utils/whatsapp-templates';
import { BOT_PAYLOADS } from '../bot/constants/bot-payloads';

const TRIAL_REQUESTS_LIMIT_KEY = 'TRIAL_REQUESTS_LIMIT';
const DEFAULT_TRIAL_LIMIT = 3;
const DEFAULT_RESPONSE_TIMEOUT_HOURS = 2;

export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly membershipsService: MembershipsService,
    private readonly matchingRepository: MatchingRepository,
    private readonly requestsRepository: RequestsRepository,
    private readonly whatsappAdapter: WhatsAppAdapter,
    private readonly botRepository: BotRepository,
    private readonly configRepository: ConfigRepository,
  ) {}

  // --- Payment link generation ---

  async generatePaymentLink(
    professionalId: string,
    planId: string,
  ): Promise<string> {
    const plan = await this.paymentsRepository.findPlanById(planId);

    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    return createPaymentLink(
      professionalId,
      planId,
      plan.name,
      plan.monthlyPrice,
    );
  }

  // --- Trial-exhausted professional notification ---

  async notifyTrialExhaustedProfessionals(
    professionalIds: string[],
    categoryName: string,
    zoneName: string,
  ): Promise<void> {
    const plans = await this.paymentsRepository.findAllActivePlans();

    if (plans.length === 0) {
      console.warn(
        '[PaymentsService] No active plans found, skipping notifications',
      );
      return;
    }

    for (const professionalId of professionalIds) {
      try {
        const pro =
          await this.matchingRepository.findProfessionalById(professionalId);

        if (!pro) continue;

        const url = `${process.env.APP_URL}/planes?pro=${professionalId}`;

        let message =
          `Hay un usuario interesado en tu servicio de ${categoryName} en ${zoneName}. ` +
          `Para recibir este pedido activá tu membresía eligiendo un plan:\n\n`;

        for (const plan of plans) {
          try {
            const link = await this.generatePaymentLink(
              professionalId,
              plan.id,
            );
            message += `• ${plan.name} — $${plan.monthlyPrice.toFixed(0)}/mes → ${link}\n`;
          } catch {
            message += `• ${plan.name} — $${plan.monthlyPrice.toFixed(0)}/mes → [no disponible]\n`;
          }
        }

        message += `\nCada link te lleva directo al pago. Una vez confirmado, te asignamos el pedido automáticamente.`;

        await this.sendWithWindowCheck(
          pro.phone,
          'PROFESSIONAL',
          message,
          'nora_pro_upgrade_membresia',
          [categoryName, zoneName, url],
        );
      } catch (err) {
        console.error(
          `[PaymentsService] Failed to notify professional ${professionalId}:`,
          err,
        );
      }
    }
  }

  // --- Webhook processing ---

  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
    requestId: string,
  ): boolean {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (!secret) {
      console.error(
        '[PaymentsService] MERCADOPAGO_WEBHOOK_SECRET not configured',
      );
      return false;
    }

    const headerParts = Object.fromEntries(
      signature.split(',').map((part) => {
        const [key, value] = part.split('=');
        return [key?.trim() ?? '', value?.trim() ?? ''];
      }),
    );

    const timestamp = headerParts.ts;
    const signatureHash = headerParts.v1;

    if (!timestamp || !signatureHash) {
      return false;
    }

    let dataId = '';

    try {
      const body = JSON.parse(rawBody.toString()) as { data?: { id?: string } };
      dataId = body.data?.id ?? '';
    } catch {
      return false;
    }

    const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    if (expected.length !== signatureHash.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHash),
    );
  }

  async processPaymentWebhook(paymentId: string): Promise<void> {
    try {
      const { status, externalReference } = await fetchPayment(paymentId);

      if (status !== 'approved') {
        console.log(
          `[PaymentsService] Payment ${paymentId} status: ${status}, skipping`,
        );
        return;
      }

      if (!externalReference) {
        console.error(
          `[PaymentsService] Payment ${paymentId} has no external_reference`,
        );
        return;
      }

      const [professionalId, planId] = externalReference.split(':');

      if (!professionalId || !planId) {
        console.error(
          `[PaymentsService] Invalid external_reference format: ${externalReference}`,
        );
        return;
      }

      const professional =
        await this.matchingRepository.findProfessionalById(professionalId);

      if (!professional) {
        console.error(
          `[PaymentsService] Professional not found: ${professionalId}`,
        );
        return;
      }

      // Check if professional already had an active membership (renewal detection)
      const existingMembership = await this.membershipsService.getActiveMembership(professionalId);
      const isRenewal = existingMembership !== null && existingMembership.endDate > new Date();

      // Activate membership from payment
      await this.membershipsService.activateFromPayment(
        professionalId,
        planId,
        paymentId,
      );

      console.log(
        `[PaymentsService] Membership activated for professional ${professionalId}`,
      );

      // Get the newly activated membership to read the new endDate
      const newMembership = await this.membershipsService.getActiveMembership(professionalId);
      const newEndDate = newMembership
        ? new Date(newMembership.endDate).toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : null;

      // Look for a waiting request matching professional's category and zone
      const matchedRequest =
        await this.requestsRepository.findWaitingRequestForProfessional(
          professionalId,
          professional.categoryId,
        );

      if (matchedRequest) {
        const responseTimeoutHours = await this.getResponseTimeoutHours();
        const now = new Date();
        const assignmentTimeoutAt = new Date(
          now.getTime() + responseTimeoutHours * 60 * 60 * 1000,
        );

        await this.requestsRepository.reactivateForProfessional(
          matchedRequest.id,
          professionalId,
          assignmentTimeoutAt,
        );

        await this.requestsRepository.createEvent({
          requestId: matchedRequest.id,
          professionalId,
          type: 'ASSIGNED',
        });

        await this.requestsRepository.updateLastAssignedAt(
          professionalId,
          now,
        );

        await this.sendWithWindowCheck(
          professional.phone,
          'PROFESSIONAL',
          `¡Tu membresía fue activada! Te asignamos un pedido de la categoría. Aceptalo o rechazalo desde tu panel.`,
          'nora_pro_membresia_activada_con_pedido',
          [matchedRequest.category.name, matchedRequest.geoNode.name],
          [
            { payload: BOT_PAYLOADS.VER_DETALLES, text: 'Ver los detalles' },
            { payload: BOT_PAYLOADS.NO_PUEDO, text: 'No puedo tomarlo' },
          ],
        );

        // Notify user via pending message in bot session
        if (matchedRequest.user?.phone) {
          const userPhone = matchedRequest.user.phone;
          const userMessage = `¡Buenas noticias! Encontré un profesional para tu pedido. Te aviso cuando confirme.`;

          await this.botRepository.upsert(userPhone, {
            role: 'USER',
            tempData: { pendingMessage: userMessage },
          });
        }

        console.log(
          `[PaymentsService] Request ${matchedRequest.id} reactivated for professional ${professionalId}`,
        );
      } else {
        if (isRenewal && newEndDate) {
          // Renewal — specific message with new endDate
          await this.sendWithWindowCheck(
            professional.phone,
            'PROFESSIONAL',
            `¡Tu membresía NORA fue renovada con éxito! 🎉\n\nSeguís activo hasta el ${newEndDate}.\n\nGracias por confiar en NORA. ¡Seguí recibiendo pedidos!`,
            MEMBERSHIP_RENEWED_TEMPLATE,
            [newEndDate],
          );
        } else {
          // New activation — existing flow unchanged
          await this.sendWithWindowCheck(
            professional.phone,
            'PROFESSIONAL',
            `¡Tu membresía fue activada! Ya podés recibir pedidos.\n\n1. Ver cómo funciona`,
            'nora_pro_membresia_activada',
            [],
            [{ payload: BOT_PAYLOADS.VER_COMO_FUNCIONA, text: 'Ver cómo funciona' }],
          );
        }
      }
    } catch (err) {
      console.error(
        `[PaymentsService] Error processing payment ${paymentId}:`,
        err,
      );
    }
  }

  // --- Trial limit helper ---

  async getTrialLimit(): Promise<number> {
    const config = await this.configRepository.findByKey(
      TRIAL_REQUESTS_LIMIT_KEY,
    );

    if (config) {
      const parsed = parseInt(config.value, 10);

      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    return DEFAULT_TRIAL_LIMIT;
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
      console.error(`[PaymentsService] Failed to send to ${phone} (${role}):`, err);
    }
  }

  private async getResponseTimeoutHours(): Promise<number> {
    const config = await this.configRepository.findByKey(
      'PROFESSIONAL_RESPONSE_TIMEOUT_HOURS',
    );

    if (config) {
      const parsed = parseInt(config.value, 10);

      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return DEFAULT_RESPONSE_TIMEOUT_HOURS;
  }
}
