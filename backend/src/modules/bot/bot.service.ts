import { BotRepository } from './bot.repository';
import { resolveFlowHandler, getFlowHandlerByName } from './flows/flow-handler.factory';
import { FlowContext, BotResponse } from './flows/types';
import { UsersService } from '../users/users.service';
import { Prisma } from '@prisma/client';

export type ProcessMessageInput = {
  phone: string;
  text?: string;
  imageUrls?: string[];
  audioUrl?: string;
  role?: 'USER' | 'PROFESSIONAL';
};

export class BotService {
  constructor(
    private readonly botRepository: BotRepository,
    private readonly usersService: UsersService,
  ) {}

  async processMessage(input: ProcessMessageInput): Promise<BotResponse & { flow?: string; step?: string }> {
    const user = await this.usersService.findOrCreateByPhone(input.phone);

    let session = await this.botRepository.findByPhone(input.phone);

    const role = input.role || (session?.role as 'USER' | 'PROFESSIONAL') || 'USER';

    const userIdentity = {
      userId: user.id,
      name: user.name,
      phone: user.phone,
    };

    if (!session) {
      const handler = resolveFlowHandler(role);

      session = await this.botRepository.upsert(input.phone, {
        role,
        currentFlow: handler.flowName,
        currentStep: handler.getInitialStep(),
        tempData: userIdentity as Prisma.InputJsonValue,
      });
    } else {
      const sessionTempData = (session.tempData as Record<string, unknown>) || {};

      if (!sessionTempData.userId) {
        sessionTempData.userId = user.id;
        sessionTempData.name = user.name;
        sessionTempData.phone = user.phone;

        session = await this.botRepository.upsert(input.phone, {
          role,
          currentFlow: session.currentFlow,
          currentStep: session.currentStep,
          tempData: sessionTempData as Prisma.InputJsonValue,
        });
      }
    }

    if (!session.currentFlow) {
      const handler = resolveFlowHandler(role);
      session.currentFlow = handler.flowName;
      session.currentStep = handler.getInitialStep();
    }

    const flowHandler = getFlowHandlerByName(session.currentFlow);
    if (!flowHandler) {
      return {
        text: 'Error interno: flujo no encontrado. Reinicia la conversacion con "hola".',
        flow: undefined,
        step: undefined,
      };
    }

    const step = session.currentStep || flowHandler.getInitialStep();

    const imageUrls = step === 'ASK_PHOTOS' ? input.imageUrls : undefined;
    const audioUrl = step === 'ASK_AUDIO' ? input.audioUrl : undefined;

    const context: FlowContext = {
      session,
      message: {
        phone: input.phone,
        text: input.text,
        imageUrls,
        audioUrl,
      },
    };

    const result = await flowHandler.handleStep(step, context);

    const finalTempData = (result.tempData as Record<string, unknown>) || {};
    if (!finalTempData.userId) finalTempData.userId = user.id;
    if (!finalTempData.name) finalTempData.name = user.name;
    if (!finalTempData.phone) finalTempData.phone = user.phone;

    const updatedSession = await this.botRepository.upsert(input.phone, {
      role,
      currentFlow: result.nextStep ? session.currentFlow : undefined,
      currentStep: result.nextStep || undefined,
      tempData: result.nextStep ? (finalTempData as Prisma.InputJsonValue) : ({} as Prisma.InputJsonValue),
    });

    return {
      text: result.response.text,
      mediaUrls: result.response.mediaUrls,
      options: result.response.options,
      requestId: result.response.requestId,
      flow: updatedSession.currentFlow || undefined,
      step: updatedSession.currentStep || undefined,
    };
  }

  async resetSession(phone: string): Promise<void> {
    await this.botRepository.deleteByPhone(phone);
  }
}
