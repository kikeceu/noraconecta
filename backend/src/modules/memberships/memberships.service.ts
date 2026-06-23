import { MembershipsRepository } from './memberships.repository';
import { PlansRepository } from '../plans/plans.repository';
import { ConfigRepository } from '../config/config.repository';
import { BotRepository } from '../bot/bot.repository';
import { WhatsAppAdapter, WhatsAppRole } from '../../lib/whatsapp-adapter';
import { shouldUseTemplate } from '../../utils/whatsapp-utils';
import { MEMBERSHIP_EXPIRY_REMINDER_TEMPLATE } from '../../utils/whatsapp-templates';
import { AppError } from '../../middleware/error-handler';
import { Membership } from '@prisma/client';

const TRIAL_REQUESTS_LIMIT_KEY = 'TRIAL_REQUESTS_LIMIT';
const DEFAULT_TRIAL_REQUESTS_LIMIT = 3;
const MONTHLY_DAYS = 30;
const ANNUAL_DAYS = 365;

function parseTrialLimit(raw: string | null): number {
  if (!raw) return DEFAULT_TRIAL_REQUESTS_LIMIT;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_TRIAL_REQUESTS_LIMIT;
}

function calculateEndDate(
  startDate: Date,
  type: 'MONTHLY' | 'ANNUAL',
): Date {
  const endDate = new Date(startDate);
  const days = type === 'MONTHLY' ? MONTHLY_DAYS : ANNUAL_DAYS;
  endDate.setDate(endDate.getDate() + days);
  return endDate;
}

export class MembershipsService {
  constructor(
    private readonly membershipsRepository: MembershipsRepository,
    private readonly plansRepository: PlansRepository,
    private readonly configRepository: ConfigRepository,
    private readonly botRepository: BotRepository,
    private readonly whatsappAdapter: WhatsAppAdapter,
  ) {}

  async canReceiveRequests(professionalId: string): Promise<boolean> {
    const activeMembership =
      await this.membershipsRepository.findActiveByProfessionalId(
        professionalId,
      );

    if (activeMembership && activeMembership.endDate > new Date()) {
      return true;
    }

    if (activeMembership && activeMembership.endDate <= new Date()) {
      await this.membershipsRepository.updateStatus(
        activeMembership.id,
        'EXPIRED',
      );
    }

    const professional =
      await this.membershipsRepository.findProfessionalById(professionalId);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    const configEntry = await this.configRepository.findByKey(
      TRIAL_REQUESTS_LIMIT_KEY,
    );
    const limit = parseTrialLimit(configEntry?.value ?? null);

    return professional.trialRequestsUsed < limit;
  }

  async getStatus(professionalId: string): Promise<{
    canReceiveRequests: boolean;
    activeMembership: Membership | null;
    trialRequestsUsed: number;
    trialRequestsLimit: number;
  }> {
    const professional =
      await this.membershipsRepository.findProfessionalById(professionalId);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    const activeMembership =
      await this.membershipsRepository.findActiveByProfessionalId(
        professionalId,
      );

    const configEntry = await this.configRepository.findByKey(
      TRIAL_REQUESTS_LIMIT_KEY,
    );
    const trialRequestsLimit = parseTrialLimit(configEntry?.value ?? null);

    let canReceive = false;

    if (activeMembership && activeMembership.endDate > new Date()) {
      canReceive = true;
    } else if (activeMembership && activeMembership.endDate <= new Date()) {
      await this.membershipsRepository.updateStatus(
        activeMembership.id,
        'EXPIRED',
      );
    }

    if (!canReceive) {
      canReceive = professional.trialRequestsUsed < trialRequestsLimit;
    }

    return {
      canReceiveRequests: canReceive,
      activeMembership: canReceive ? activeMembership : null,
      trialRequestsUsed: professional.trialRequestsUsed,
      trialRequestsLimit,
    };
  }

  async activateMembership(
    professionalId: string,
    planId: string,
    type: 'MONTHLY' | 'ANNUAL',
    activatedBy?: string,
  ): Promise<Membership> {
    const professional =
      await this.membershipsRepository.findProfessionalById(professionalId);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    const plan = await this.plansRepository.findById(planId);

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    const startDate = new Date();
    const endDate = calculateEndDate(startDate, type);

    return this.membershipsRepository.create({
      professionalId,
      planId,
      type,
      startDate,
      endDate,
      activatedBy,
    });
  }

  async getActiveMembership(professionalId: string): Promise<Membership | null> {
    return this.membershipsRepository.findActiveByProfessionalId(professionalId);
  }

  async activateFromPayment(
    professionalId: string,
    planId: string,
    paymentRef: string,
  ): Promise<Membership> {
    const professional =
      await this.membershipsRepository.findProfessionalById(professionalId);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    const plan = await this.plansRepository.findById(planId);

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    const startDate = new Date();
    const endDate = calculateEndDate(startDate, 'MONTHLY');

    return this.membershipsRepository.create({
      professionalId,
      planId,
      type: 'MONTHLY',
      status: 'ACTIVE',
      startDate,
      endDate,
      activatedBy: 'mercadopago',
      paymentRef,
    });
  }

  async sendExpirationReminders(): Promise<void> {
    try {
      const daysConfig = await this.configRepository.findByKey('MEMBERSHIP_REMINDER_DAYS_AHEAD');
      const daysAhead = parseInt(daysConfig?.value ?? '3', 10);

      const expiring = await this.membershipsRepository.findExpiringMemberships(daysAhead);

      if (expiring.length === 0) return;

      for (const membership of expiring) {
        try {
          const professionalPhone = membership.professional.phone;
          const professionalName = membership.professional.name;
          const endDate = new Date(membership.endDate).toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });

          const textMessage =
            `Hola ${professionalName}, tu membresía NORA vence el ${endDate}.\n\n` +
            `Para renovarla y seguir recibiendo pedidos, transferí el importe a:\n\n` +
            `nora.conecta.mp\n\n` +
            `Una vez realizado el pago, envianos el comprobante por WhatsApp y activamos tu cuenta de inmediato.`;

          await this.sendWithWindowCheck(
            professionalPhone,
            'PROFESSIONAL',
            textMessage,
            MEMBERSHIP_EXPIRY_REMINDER_TEMPLATE,
            [professionalName, endDate],
          );

          await this.membershipsRepository.markReminderSent(membership.id);

          console.log(
            `[memberships] Renewal reminder sent to ${professionalPhone} (membership ${membership.id}, expires ${endDate})`,
          );
        } catch (err) {
          console.error(
            `[memberships] Failed to send renewal reminder for membership ${membership.id}:`,
            err,
          );
        }
      }

      await this.membershipsRepository.clearExpiredReminderFlags();
    } catch (err) {
      console.error('[memberships] sendExpirationReminders failed:', err);
    }
  }

  private async sendWithWindowCheck(
    phone: string,
    role: WhatsAppRole,
    text: string,
    templateName: string,
    templateParams: string[],
  ): Promise<void> {
    try {
      const needsTemplate = await shouldUseTemplate(phone, role, this.botRepository);

      if (needsTemplate) {
        await this.whatsappAdapter.sendTemplate(phone, templateName, templateParams, role);
      } else {
        await this.whatsappAdapter.sendText(phone, text, role);
      }
    } catch (err) {
      console.error(`[MembershipsService] Failed to send to ${phone} (${role}):`, err);
    }
  }
}
