import crypto from 'crypto';
import { PaymentsRepository } from './payments.repository';
import { MembershipsService } from '../memberships/memberships.service';
import { MatchingRepository } from '../matching/matching.repository';
import { RequestsRepository } from '../requests/requests.repository';
import { WhatsAppAdapter } from '../../lib/whatsapp-adapter';
import { BotRepository } from '../bot/bot.repository';
import { ConfigRepository } from '../config/config.repository';
import { createPaymentLink, fetchPayment } from '../../lib/mercadopago-client';

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

        await this.whatsappAdapter.sendText(pro.phone, message, 'PROFESSIONAL');
      } catch (err) {
        console.error(
          `[PaymentsService] Failed to notify professional ${professionalId}:`,
          err,
        );
      }
    }
  }

  // --- Webhook processing ---

  verifyWebhookSignature(payload: Buffer, signature: string): boolean {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (!secret) {
      console.error(
        '[PaymentsService] MERCADOPAGO_WEBHOOK_SECRET not configured',
      );
      return false;
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
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

      // Activate membership from payment
      await this.membershipsService.activateFromPayment(
        professionalId,
        planId,
        paymentId,
      );

      console.log(
        `[PaymentsService] Membership activated for professional ${professionalId}`,
      );

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

        // Notify professional
        await this.whatsappAdapter.sendText(
          professional.phone,
          `¡Tu membresía fue activada! Te asignamos un pedido de la categoría. Aceptalo o rechazalo desde tu panel.`,
          'PROFESSIONAL',
        );

        // Notify user via pending message in bot session
        if ((matchedRequest as unknown as { user?: { phone?: string } }).user
          ?.phone) {
          const userPhone = (
            matchedRequest as unknown as { user: { phone: string } }
          ).user.phone;
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
        await this.whatsappAdapter.sendText(
          professional.phone,
          `¡Tu membresía fue activada! Ya podés recibir pedidos.`,
          'PROFESSIONAL',
        );
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
