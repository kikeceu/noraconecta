import { FlowHandler } from './types';
import { UserRequestFlow } from './user-request.flow';
import { ProfessionalRegisterFlow } from './professional-register.flow';

const userRequestFlow = new UserRequestFlow();
const professionalRegisterFlow = new ProfessionalRegisterFlow();

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
    default:
      return null;
  }
}
