import { FlowHandler } from './types';
import { UserRequestFlow } from './user-request.flow';
import { ProfessionalRegisterFlow } from './professional-register.flow';
import { CoordinationFlow } from './coordination.flow';
import { RequestsService } from '../../requests/requests.service';
import { RequestsRepository } from '../../requests/requests.repository';
import { MatchingRepository } from '../../matching/matching.repository';
import { UsersRepository } from '../../users/users.repository';
import { BotRepository } from '../../bot/bot.repository';
import { CoordinationService } from '../../bot/coordination.service';
import { ProfessionalsService } from '../../professionals/professionals.service';
import { ProfessionalsRepository } from '../../professionals/professionals.repository';
import { PaymentsService } from '../../payments/payments.service';
import { PaymentsRepository } from '../../payments/payments.repository';
import { PlansRepository } from '../../plans/plans.repository';
import { MembershipsService } from '../../memberships/memberships.service';
import { MembershipsRepository } from '../../memberships/memberships.repository';
import { ConfigRepository } from '../../config/config.repository';
import { NotificationService } from '../../notifications/notification.service';
import { WhatsAppAdapter } from '../../../lib/whatsapp-adapter';
import { R2Client } from '../../../lib/r2-client';

const requestsRepository = new RequestsRepository();
const usersRepository = new UsersRepository();
const matchingRepository = new MatchingRepository();
const botRepository = new BotRepository();
const r2Client = new R2Client();
const whatsappAdapter = new WhatsAppAdapter(r2Client, botRepository);
const notificationService = new NotificationService(whatsappAdapter);
const coordinationService = new CoordinationService(botRepository, whatsappAdapter);
const requestsService = new RequestsService(
  requestsRepository,
  usersRepository,
  matchingRepository,
  botRepository,
  undefined,
  undefined,
  notificationService,
  coordinationService,
);

const professionalsRepository = new ProfessionalsRepository();
const professionalsService = new ProfessionalsService(professionalsRepository);

const paymentsRepository = new PaymentsRepository();
const plansRepository = new PlansRepository();
const membershipsRepository = new MembershipsRepository();
const configRepository = new ConfigRepository();

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

const userRequestFlow = new UserRequestFlow(requestsService, paymentsService);
const professionalRegisterFlow = new ProfessionalRegisterFlow(professionalsService, professionalsRepository);
const coordinationFlow = new CoordinationFlow(requestsService);

export function resolveFlowHandler(role: 'USER' | 'PROFESSIONAL'): FlowHandler {
  switch (role) {
    case 'USER':
      return userRequestFlow;
    case 'PROFESSIONAL':
      return professionalRegisterFlow;
    default:
      return userRequestFlow;
  }
}

export function getFlowHandlerByName(flowName: string): FlowHandler | null {
  switch (flowName) {
    case 'USER_REQUEST':
      return userRequestFlow;
    case 'PROFESSIONAL_REGISTER':
      return professionalRegisterFlow;
    case 'COORDINATION':
      return coordinationFlow;
    default:
      return null;
  }
}
