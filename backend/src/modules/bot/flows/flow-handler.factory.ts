import { FlowHandler } from './types';
import { UserRequestFlow } from './user-request.flow';
import { ProfessionalRegisterFlow } from './professional-register.flow';
import { CoordinationFlow } from './coordination.flow';
import { RequestsService } from '../../requests/requests.service';
import { RequestsRepository } from '../../requests/requests.repository';
import { MatchingRepository } from '../../matching/matching.repository';
import { UsersRepository } from '../../users/users.repository';
import { BotRepository } from '../../bot/bot.repository';
import { ProfessionalsService } from '../../professionals/professionals.service';
import { ProfessionalsRepository } from '../../professionals/professionals.repository';

const requestsRepository = new RequestsRepository();
const usersRepository = new UsersRepository();
const matchingRepository = new MatchingRepository();
const botRepository = new BotRepository();
const requestsService = new RequestsService(requestsRepository, usersRepository, matchingRepository, botRepository);

const professionalsRepository = new ProfessionalsRepository();
const professionalsService = new ProfessionalsService(professionalsRepository);

const userRequestFlow = new UserRequestFlow(requestsService);
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
