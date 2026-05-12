import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { PlansRepository } from '../plans/plans.repository';
import { MembershipsService } from '../memberships/memberships.service';
import { MembershipsRepository } from '../memberships/memberships.repository';
import { ConfigRepository } from '../config/config.repository';
import { MatchingRepository } from '../matching/matching.repository';
import { RequestsRepository } from '../requests/requests.repository';
import { WhatsAppAdapter } from '../../lib/whatsapp-adapter';
import { R2Client } from '../../lib/r2-client';
import { BotRepository } from '../bot/bot.repository';

const paymentsRepository = new PaymentsRepository();
const plansRepository = new PlansRepository();
const membershipsRepository = new MembershipsRepository();
const configRepository = new ConfigRepository();
const matchingRepository = new MatchingRepository();
const requestsRepository = new RequestsRepository();
const r2Client = new R2Client();
const botRepository = new BotRepository();
const whatsappAdapter = new WhatsAppAdapter(r2Client, botRepository);

const membershipsService = new MembershipsService(
  membershipsRepository,
  plansRepository,
  configRepository,
);

const paymentsService = new PaymentsService(
  paymentsRepository,
  membershipsService,
  matchingRepository,
  requestsRepository,
  whatsappAdapter,
  botRepository,
  configRepository,
);

const paymentsController = new PaymentsController(paymentsService);

const router = Router();

router.post('/mercadopago', paymentsController.handleWebhook);

export default router;
